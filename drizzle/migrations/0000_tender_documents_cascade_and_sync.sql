ALTER TABLE public.documents DROP CONSTRAINT documents_tender_id_fkey;
ALTER TABLE public.documents ADD CONSTRAINT documents_tender_id_fkey
  FOREIGN KEY (tender_id) REFERENCES public.tenders(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION private.fmt_vnd(n numeric) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN n IS NULL THEN NULL
    ELSE replace(to_char(trunc(n), 'FM999,999,999,999,999,990'), ',', '.') END
$$;

CREATE OR REPLACE FUNCTION private.method_label(v text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE v
    WHEN 'chi_dinh_thau_rut_gon' THEN 'Chỉ định thầu rút gọn'
    WHEN 'dam_phan_truc_tiep' THEN 'Đàm phán trực tiếp'
    WHEN 'chao_hang_canh_tranh_rut_gon' THEN 'Chào hàng cạnh tranh rút gọn'
    WHEN 'chao_hang_canh_tranh_thong_thuong' THEN 'Chào hàng cạnh tranh thông thường'
    WHEN 'dau_thau_rong_rai_2_tui' THEN 'Đấu thầu rộng rãi 2 túi'
    ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION private.method_value(l text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE lower(btrim(l))
    WHEN lower('Chỉ định thầu rút gọn') THEN 'chi_dinh_thau_rut_gon'
    WHEN lower('Đàm phán trực tiếp') THEN 'dam_phan_truc_tiep'
    WHEN lower('Chào hàng cạnh tranh rút gọn') THEN 'chao_hang_canh_tranh_rut_gon'
    WHEN lower('Chào hàng cạnh tranh thông thường') THEN 'chao_hang_canh_tranh_thong_thuong'
    WHEN lower('Đấu thầu rộng rãi 2 túi') THEN 'dau_thau_rong_rai_2_tui'
    ELSE NULL END
$$;

-- Ghi một giá trị dùng chung xuống mọi hồ sơ của gói thầu (không ghi chuỗi rỗng).
CREATE OR REPLACE FUNCTION private.push_tender_field(_tender uuid, _key text, _val text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _val IS NULL OR btrim(_val) = '' THEN RETURN; END IF;
  UPDATE public.document_fields f
     SET value = _val, confidence = 1, needs_review = false
    FROM public.documents d
   WHERE f.document_id = d.id AND d.tender_id = _tender
     AND f.field_key = _key AND f.value IS DISTINCT FROM _val;
END; $$;

-- Hồ sơ -> gói thầu
CREATE OR REPLACE FUNCTION public.sync_doc_field_to_tender() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t uuid; v text; digits text; td_key text; td_val text;
BEGIN
  IF pg_trigger_depth() > 1 OR NEW.value IS NOT DISTINCT FROM OLD.value
     OR coalesce(current_setting('app.skip_tender_sync', true), '') = 'on' THEN RETURN NEW; END IF;
  IF NEW.field_key NOT IN ('Ten_goi_thau','Gia_goi_thau_numb','Gia_goi_thau_text','Nguon_von','Hinh_thuc_LCNT') THEN RETURN NEW; END IF;
  v := nullif(btrim(NEW.value), '');
  IF v IS NULL THEN RETURN NEW; END IF;
  SELECT tender_id INTO _t FROM public.documents WHERE id = NEW.document_id;
  IF _t IS NULL THEN RETURN NEW; END IF;

  IF NEW.field_key = 'Ten_goi_thau' THEN
    UPDATE public.tenders SET name = v WHERE id = _t AND name IS DISTINCT FROM v;
    td_key := 'ten_goi_thau'; td_val := v;
  ELSIF NEW.field_key = 'Gia_goi_thau_numb' THEN
    digits := regexp_replace(v, '\D', '', 'g');
    IF digits = '' THEN RETURN NEW; END IF;
    UPDATE public.tenders SET package_value = digits::numeric WHERE id = _t AND package_value IS DISTINCT FROM digits::numeric;
    td_key := 'gia_goi_thau'; td_val := private.fmt_vnd(digits::numeric);
  ELSIF NEW.field_key = 'Gia_goi_thau_text' THEN
    td_key := 'gia_bang_chu'; td_val := v;
  ELSIF NEW.field_key = 'Nguon_von' THEN
    UPDATE public.tenders SET funding_source = v WHERE id = _t AND funding_source IS DISTINCT FROM v;
    td_key := 'nguon_von'; td_val := v;
  ELSIF NEW.field_key = 'Hinh_thuc_LCNT' THEN
    IF private.method_value(v) IS NOT NULL THEN
      UPDATE public.tenders SET method = private.method_value(v) WHERE id = _t AND method IS DISTINCT FROM private.method_value(v);
    END IF;
  END IF;

  IF td_key IS NOT NULL THEN
    INSERT INTO public.tender_data (tender_id, data) VALUES (_t, jsonb_build_object(td_key, td_val))
    ON CONFLICT (tender_id) DO UPDATE SET data = public.tender_data.data || excluded.data
      WHERE public.tender_data.data ->> td_key IS DISTINCT FROM td_val;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_document_fields_sync_to_tender
AFTER UPDATE OF value ON public.document_fields
FOR EACH ROW EXECUTE FUNCTION public.sync_doc_field_to_tender();

-- Gói thầu (bảng tenders) -> dữ liệu chung + hồ sơ
CREATE OR REPLACE FUNCTION public.sync_tender_to_docs() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE patch jsonb := '{}'::jsonb;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.name IS DISTINCT FROM OLD.name AND btrim(coalesce(NEW.name,'')) <> '' THEN
    PERFORM private.push_tender_field(NEW.id, 'Ten_goi_thau', NEW.name);
    patch := patch || jsonb_build_object('ten_goi_thau', NEW.name);
  END IF;
  IF NEW.package_value IS DISTINCT FROM OLD.package_value AND NEW.package_value IS NOT NULL THEN
    PERFORM private.push_tender_field(NEW.id, 'Gia_goi_thau_numb', private.fmt_vnd(NEW.package_value));
    patch := patch || jsonb_build_object('gia_goi_thau', private.fmt_vnd(NEW.package_value));
  END IF;
  IF NEW.funding_source IS DISTINCT FROM OLD.funding_source AND btrim(coalesce(NEW.funding_source,'')) <> '' THEN
    PERFORM private.push_tender_field(NEW.id, 'Nguon_von', NEW.funding_source);
    patch := patch || jsonb_build_object('nguon_von', NEW.funding_source);
  END IF;
  IF NEW.location IS DISTINCT FROM OLD.location AND btrim(coalesce(NEW.location,'')) <> '' THEN
    patch := patch || jsonb_build_object('dia_diem', NEW.location);
  END IF;
  IF NEW.method IS DISTINCT FROM OLD.method AND private.method_label(NEW.method) IS NOT NULL THEN
    PERFORM private.push_tender_field(NEW.id, 'Hinh_thuc_LCNT', private.method_label(NEW.method));
  END IF;
  IF patch <> '{}'::jsonb THEN
    INSERT INTO public.tender_data (tender_id, data) VALUES (NEW.id, patch)
    ON CONFLICT (tender_id) DO UPDATE SET data = public.tender_data.data || excluded.data;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_tenders_sync_to_docs
AFTER UPDATE ON public.tenders
FOR EACH ROW EXECUTE FUNCTION public.sync_tender_to_docs();

-- Dữ liệu chung (tender_data) -> bảng tenders + hồ sơ
CREATE OR REPLACE FUNCTION public.sync_tender_data_to_docs() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o jsonb := CASE WHEN TG_OP = 'UPDATE' THEN OLD.data ELSE '{}'::jsonb END;
  n jsonb := NEW.data;
  v text; digits text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  v := nullif(btrim(n ->> 'ten_goi_thau'), '');
  IF v IS NOT NULL AND v IS DISTINCT FROM o ->> 'ten_goi_thau' THEN
    UPDATE public.tenders SET name = v WHERE id = NEW.tender_id AND name IS DISTINCT FROM v;
    PERFORM private.push_tender_field(NEW.tender_id, 'Ten_goi_thau', v);
  END IF;
  v := nullif(btrim(n ->> 'gia_goi_thau'), '');
  IF v IS NOT NULL AND v IS DISTINCT FROM o ->> 'gia_goi_thau' THEN
    digits := regexp_replace(v, '\D', '', 'g');
    IF digits <> '' THEN
      UPDATE public.tenders SET package_value = digits::numeric WHERE id = NEW.tender_id AND package_value IS DISTINCT FROM digits::numeric;
      PERFORM private.push_tender_field(NEW.tender_id, 'Gia_goi_thau_numb', private.fmt_vnd(digits::numeric));
    END IF;
  END IF;
  v := nullif(btrim(n ->> 'gia_bang_chu'), '');
  IF v IS NOT NULL AND v IS DISTINCT FROM o ->> 'gia_bang_chu' THEN
    PERFORM private.push_tender_field(NEW.tender_id, 'Gia_goi_thau_text', v);
  END IF;
  v := nullif(btrim(n ->> 'nguon_von'), '');
  IF v IS NOT NULL AND v IS DISTINCT FROM o ->> 'nguon_von' THEN
    UPDATE public.tenders SET funding_source = v WHERE id = NEW.tender_id AND funding_source IS DISTINCT FROM v;
    PERFORM private.push_tender_field(NEW.tender_id, 'Nguon_von', v);
  END IF;
  v := nullif(btrim(n ->> 'dia_diem'), '');
  IF v IS NOT NULL AND v IS DISTINCT FROM o ->> 'dia_diem' THEN
    UPDATE public.tenders SET location = v WHERE id = NEW.tender_id AND location IS DISTINCT FROM v;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_tender_data_sync_to_docs
AFTER INSERT OR UPDATE ON public.tender_data
FOR EACH ROW EXECUTE FUNCTION public.sync_tender_data_to_docs();

REVOKE ALL ON FUNCTION private.push_tender_field(uuid, text, text) FROM PUBLIC, anon, authenticated;