CREATE TABLE public.tender_method_field_order (method text PRIMARY KEY, field_keys text[] NOT NULL DEFAULT '{}');
GRANT SELECT, INSERT, UPDATE ON public.tender_method_field_order TO authenticated;
GRANT ALL ON public.tender_method_field_order TO service_role;
ALTER TABLE public.tender_method_field_order ENABLE ROW LEVEL SECURITY;
CREATE POLICY method_fields_read ON public.tender_method_field_order FOR SELECT TO authenticated USING (private.can_tender(auth.uid()));
CREATE POLICY method_fields_insert ON public.tender_method_field_order FOR INSERT TO authenticated WITH CHECK (private.can_tender(auth.uid()) AND private.can_write(auth.uid()));
CREATE POLICY method_fields_update ON public.tender_method_field_order FOR UPDATE TO authenticated USING (private.can_tender(auth.uid()) AND private.can_write(auth.uid())) WITH CHECK (private.can_tender(auth.uid()) AND private.can_write(auth.uid()));
CREATE FUNCTION public.update_template_region_group(_changes jsonb) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb; n integer := 0; affected integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_active_user(auth.uid()) OR NOT private.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Chỉ quản trị viên được sửa vùng dữ liệu'; END IF;
 IF jsonb_typeof(_changes) <> 'array' OR jsonb_array_length(_changes) = 0 OR jsonb_array_length(_changes) > 500 THEN RAISE EXCEPTION 'Danh sách cập nhật không hợp lệ'; END IF;
 PERFORM 1 FROM public.template_mappings WHERE id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(_changes) x) ORDER BY id FOR UPDATE;
 FOR item IN SELECT value FROM jsonb_array_elements(_changes) LOOP
  IF (item->>'placeholder') IS NULL OR (item->>'placeholder') !~ '^[A-Za-z0-9_]+$' THEN RAISE EXCEPTION 'Ký hiệu không hợp lệ'; END IF;
  UPDATE public.template_mappings SET placeholder=item->>'placeholder', label=item->>'label', source_field=item->>'source_field', updated_by=auth.uid()
  WHERE id=(item->>'id')::uuid AND template_id=(item->>'template_id')::uuid AND updated_at=(item->>'expected_updated_at')::timestamptz;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Vùng đã thay đổi; tải lại danh sách trước khi sửa'; END IF;
  n := n + affected;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.update_template_region_group(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_template_region_group(jsonb) TO authenticated;
COMMENT ON TABLE public.tender_method_field_order IS 'Shared Word input ordering per procurement method; does not modify tender values or Word files.';