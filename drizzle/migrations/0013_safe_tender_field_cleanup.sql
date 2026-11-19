CREATE FUNCTION private.region_norm(_value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT regexp_replace(lower(translate(coalesce(_value,''),'đĐ','dd')), '[[:space:]_.:\-]+','','g') $$;
GRANT EXECUTE ON FUNCTION private.region_norm(text) TO authenticated;
CREATE FUNCTION public.cleanup_tender_fields(_rows jsonb) RETURNS SETOF uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item jsonb; f public.document_fields; doc public.documents; _method text; _key text; removed uuid; _redirect boolean; _mismatch boolean;
BEGIN
 IF NOT private.is_active_user(auth.uid()) OR NOT private.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Chỉ quản trị viên được dọn trường'; END IF;
 IF jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows)>50 THEN RAISE EXCEPTION 'Mỗi lô tối đa 50 dòng'; END IF;
 -- Lock all sibling fields and document linkage, preventing concurrent value entry while evaluating.
 PERFORM 1 FROM public.documents WHERE id IN (SELECT document_id FROM public.document_fields WHERE id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(_rows) x)) ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public.document_fields WHERE document_id IN (SELECT document_id FROM public.document_fields WHERE id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(_rows) x)) ORDER BY id FOR UPDATE;
 FOR item IN SELECT value FROM jsonb_array_elements(_rows) LOOP
  SELECT * INTO f FROM public.document_fields WHERE id=(item->>'id')::uuid;
  IF NOT FOUND OR f.updated_at IS DISTINCT FROM (item->>'updated_at')::timestamptz OR btrim(coalesce(f.value,''))<>'' OR NOT f.needs_review THEN CONTINUE; END IF;
  SELECT * INTO doc FROM public.documents WHERE id=f.document_id;
  SELECT method INTO _method FROM public.tenders WHERE id=doc.tender_id;
  _key := private.region_norm(f.field_key);
  -- Conflicting entered values always require manual handling, including empty siblings.
  IF (SELECT count(DISTINCT btrim(value)) FROM public.document_fields WHERE document_id=f.document_id AND private.region_norm(field_key)=_key AND btrim(coalesce(value,''))<>'')>1 THEN CONTINUE; END IF;
  IF item->>'group'='duplicate' THEN
   -- UI pins the retained sibling; recheck it is still present and unchanged.
   IF NOT EXISTS (SELECT 1 FROM public.document_fields k WHERE k.id=(item->>'keeper_id')::uuid AND k.document_id=f.document_id AND k.id<>f.id AND private.region_norm(k.field_key)=_key AND k.updated_at=(item->>'keeper_updated_at')::timestamptz) THEN CONTINUE; END IF;
  ELSIF item->>'group'='legacy' THEN
   IF f.field_group IS DISTINCT FROM 'Khác' OR f.sort_order<>999 OR EXISTS(SELECT 1 FROM public.document_fields k WHERE k.document_id=f.document_id AND k.id<>f.id AND private.region_norm(k.field_key)=_key) THEN CONTINUE; END IF;
   SELECT EXISTS(SELECT 1 FROM public.template_mappings m JOIN public.templates t ON t.id=m.template_id WHERE t.module='tender' AND private.region_norm(m.placeholder)=_key AND nullif(m.source_field,'') IS NOT NULL AND private.region_norm(m.source_field)<>_key) INTO _redirect;
   SELECT EXISTS(SELECT 1 FROM public.template_mappings m JOIN public.templates t ON t.id=m.template_id WHERE t.module='tender' AND (private.region_norm(m.placeholder)=_key OR private.region_norm(m.source_field)=_key)) AND NOT EXISTS(SELECT 1 FROM public.template_mappings m JOIN public.templates t ON t.id=m.template_id WHERE t.module='tender' AND t.method IS NOT DISTINCT FROM _method AND (private.region_norm(m.placeholder)=_key OR private.region_norm(m.source_field)=_key)) INTO _mismatch;
   IF doc.tender_id IS NOT NULL AND NOT _redirect AND NOT _mismatch THEN CONTINUE; END IF;
  ELSE CONTINUE; END IF;
  DELETE FROM public.document_fields WHERE id=f.id AND updated_at=f.updated_at AND btrim(coalesce(value,''))='' AND needs_review RETURNING id INTO removed;
  IF FOUND THEN RETURN NEXT removed; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.cleanup_tender_fields(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cleanup_tender_fields(jsonb) TO authenticated;