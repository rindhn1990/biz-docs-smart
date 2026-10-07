CREATE OR REPLACE FUNCTION public.sync_tender_shared_field()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE _tender uuid;
BEGIN
  IF pg_trigger_depth() > 1 OR NEW.value IS NOT DISTINCT FROM OLD.value
     OR coalesce(current_setting('app.skip_tender_sync', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  SELECT tender_id INTO _tender FROM public.documents WHERE id = NEW.document_id;
  IF _tender IS NULL THEN RETURN NEW; END IF;
  UPDATE public.document_fields f
     SET value = NEW.value
    FROM public.documents d
   WHERE f.document_id = d.id AND d.tender_id = _tender
     AND f.document_id <> NEW.document_id
     AND f.field_key = NEW.field_key
     AND f.value IS DISTINCT FROM NEW.value;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.reset_document_fields(_document_id uuid)
 RETURNS integer LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  PERFORM set_config('app.skip_tender_sync', 'on', true);
  UPDATE public.document_fields SET value = NULL WHERE document_id = _document_id AND value IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('app.skip_tender_sync', 'off', true);
  RETURN n;
END; $function$;
REVOKE ALL ON FUNCTION public.reset_document_fields(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_document_fields(uuid) TO authenticated;