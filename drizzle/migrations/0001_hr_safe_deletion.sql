ALTER TABLE public.employee_documents DROP CONSTRAINT employee_documents_employee_id_fkey;
ALTER TABLE public.employee_documents ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
CREATE TABLE public.hr_file_cleanup (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), storage_path text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.hr_file_cleanup TO service_role;
ALTER TABLE public.hr_file_cleanup ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.delete_hr_entity(_id uuid, _kind text) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Chỉ quản trị viên được xoá nhân sự hoặc hồ sơ.'; END IF;
 IF _kind = 'employee' THEN
  PERFORM 1 FROM public.employees WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nhân sự đã được xoá hoặc không tồn tại.'; END IF;
  INSERT INTO public.hr_file_cleanup(storage_path) SELECT DISTINCT storage_path FROM public.employee_documents WHERE employee_id = _id AND storage_path IS NOT NULL AND storage_path <> '' ON CONFLICT DO NOTHING;
  DELETE FROM public.employees WHERE id = _id;
 ELSIF _kind = 'document' THEN
  PERFORM 1 FROM public.employee_documents WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hồ sơ đã được xoá hoặc không tồn tại.'; END IF;
  INSERT INTO public.hr_file_cleanup(storage_path) SELECT storage_path FROM public.employee_documents WHERE id = _id AND storage_path IS NOT NULL AND storage_path <> '' ON CONFLICT DO NOTHING;
  DELETE FROM public.employee_documents WHERE id = _id;
 ELSE RAISE EXCEPTION 'Loại dữ liệu cần xoá không hợp lệ.';
 END IF;
END $$;
GRANT INSERT, SELECT ON public.hr_file_cleanup TO authenticated;
CREATE POLICY hr_cleanup_admin_insert ON public.hr_file_cleanup FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY hr_cleanup_admin_read ON public.hr_file_cleanup FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));
REVOKE ALL ON FUNCTION public.delete_hr_entity(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_hr_entity(uuid,text) TO authenticated;
