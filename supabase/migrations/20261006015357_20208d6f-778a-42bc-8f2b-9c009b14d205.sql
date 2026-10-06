CREATE INDEX IF NOT EXISTS idx_documents_tender_id ON public.documents(tender_id);
CREATE INDEX IF NOT EXISTS idx_document_fields_doc_key ON public.document_fields(document_id, field_key);

CREATE OR REPLACE FUNCTION public.sync_tender_shared_field()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _tender uuid;
BEGIN
  IF pg_trigger_depth() > 1 OR NEW.value IS NOT DISTINCT FROM OLD.value THEN
    RETURN NEW;
  END IF;
  SELECT tender_id INTO _tender FROM public.documents WHERE id = NEW.document_id;
  IF _tender IS NULL THEN RETURN NEW; END IF;
  UPDATE public.document_fields f
     SET value = NEW.value
    FROM public.documents d
   WHERE f.document_id = d.id
     AND d.tender_id = _tender
     AND f.document_id <> NEW.document_id
     AND f.field_key = NEW.field_key
     AND f.value IS DISTINCT FROM NEW.value;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_document_fields_sync_tender ON public.document_fields;
CREATE TRIGGER trg_document_fields_sync_tender
AFTER UPDATE OF value ON public.document_fields
FOR EACH ROW EXECUTE FUNCTION public.sync_tender_shared_field();