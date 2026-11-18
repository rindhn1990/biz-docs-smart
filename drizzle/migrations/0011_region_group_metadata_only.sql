CREATE OR REPLACE FUNCTION public.update_template_region_group(_changes jsonb) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE item jsonb; n integer := 0; affected integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_active_user(auth.uid()) OR NOT private.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Chỉ quản trị viên được sửa vùng dữ liệu'; END IF;
 IF jsonb_typeof(_changes) <> 'array' OR jsonb_array_length(_changes) = 0 OR jsonb_array_length(_changes) > 500 THEN RAISE EXCEPTION 'Danh sách cập nhật không hợp lệ'; END IF;
 PERFORM 1 FROM public.template_mappings WHERE id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(_changes) x) ORDER BY id FOR UPDATE;
 FOR item IN SELECT value FROM jsonb_array_elements(_changes) LOOP
  UPDATE public.template_mappings SET label=CASE WHEN item ? 'label' THEN item->>'label' ELSE label END,
   source_field=CASE WHEN item ? 'source_field' THEN item->>'source_field' ELSE source_field END,
   date_format=CASE WHEN item ? 'date_format' THEN item->>'date_format' ELSE date_format END,
   value=CASE WHEN item ? 'value' THEN item->>'value' ELSE value END, updated_by=auth.uid()
  WHERE id=(item->>'id')::uuid AND template_id=(item->>'template_id')::uuid AND updated_at=(item->>'expected_updated_at')::timestamptz;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Vùng đã thay đổi; tải lại danh sách trước khi sửa'; END IF;
  n := n + affected;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.update_template_region_group(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_template_region_group(jsonb) TO authenticated;