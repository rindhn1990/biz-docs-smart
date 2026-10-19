CREATE TABLE public.hr_units (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT hr_units_name_nonempty CHECK (btrim(name) <> ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_units TO authenticated;
GRANT ALL ON public.hr_units TO service_role;
ALTER TABLE public.hr_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY hr_units_read ON public.hr_units FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active AND (can_access_hr OR private.has_role(auth.uid(),'admin'))));
CREATE POLICY hr_units_write ON public.hr_units FOR INSERT TO authenticated WITH CHECK (private.can_write(auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active AND (can_access_hr OR private.has_role(auth.uid(),'admin'))));
CREATE POLICY hr_units_update ON public.hr_units FOR UPDATE TO authenticated USING (private.can_write(auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active AND (can_access_hr OR private.has_role(auth.uid(),'admin')))) WITH CHECK (private.can_write(auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active AND (can_access_hr OR private.has_role(auth.uid(),'admin'))));
CREATE POLICY hr_units_delete ON public.hr_units FOR DELETE TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE UNIQUE INDEX hr_units_name_ci ON public.hr_units(lower(btrim(name)));
CREATE TRIGGER hr_units_updated BEFORE UPDATE ON public.hr_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.employees ADD COLUMN unit_id uuid REFERENCES public.hr_units(id) ON DELETE SET NULL;
CREATE INDEX employees_unit_id_idx ON public.employees(unit_id);
CREATE OR REPLACE VIEW public.hr_unit_counts WITH (security_invoker = true) AS SELECT u.id,u.name,u.sort_order,count(e.id)::integer AS employee_count FROM public.hr_units u LEFT JOIN public.employees e ON e.unit_id=u.id GROUP BY u.id;
GRANT SELECT ON public.hr_unit_counts TO authenticated, service_role;
CREATE OR REPLACE VIEW public.employee_summary_view WITH (security_invoker = true) AS
WITH latest_fields AS (
 SELECT DISTINCT ON (d.employee_id,f.field_key) d.employee_id,f.field_key,NULLIF(btrim(f.value),'') AS value,d.id AS document_id
 FROM public.employee_document_fields f JOIN public.employee_documents d ON d.id=f.document_id
 WHERE d.employee_id IS NOT NULL AND NULLIF(btrim(f.value),'') IS NOT NULL
 ORDER BY d.employee_id,f.field_key,f.updated_at DESC,f.created_at DESC
), fv AS (SELECT employee_id,jsonb_object_agg(field_key,value) AS v FROM latest_fields GROUP BY employee_id),
latest_doc AS (SELECT DISTINCT ON (employee_id) employee_id,id FROM public.employee_documents WHERE employee_id IS NOT NULL ORDER BY employee_id,created_at DESC),
cur_contract AS (SELECT DISTINCT ON (employee_id) * FROM public.employee_contracts WHERE employee_id IS NOT NULL ORDER BY employee_id,(status='active') DESC,end_date DESC,start_date DESC NULLS LAST)
SELECT e.id,e.full_name,
COALESCE(to_char(e.date_of_birth::timestamptz,'DD/MM/YYYY'),fv.v->>'date_of_birth') AS date_of_birth,
COALESCE(e.id_number,fv.v->>'id_number') AS id_number,
COALESCE(to_char(e.id_issue_date::timestamptz,'DD/MM/YYYY'),fv.v->>'id_issue_date') AS id_issue_date,
COALESCE(e.id_issue_place,fv.v->>'id_issue_place') AS id_issue_place,
COALESCE(e.hometown,fv.v->>'hometown') AS hometown,
COALESCE(c.position,e.position,fv.v->>'position') AS position,
COALESCE(e.department,fv.v->>'department') AS department,
COALESCE(e.degree_name,fv.v->>'degree_name') AS degree_name,
COALESCE(e.degree_major,fv.v->>'degree_major') AS degree_major,
COALESCE(e.degree_school,fv.v->>'degree_school') AS degree_school,
c.id AS contract_id,c.contract_number,c.contract_type,c.base_salary,c.start_date,c.end_date,c.status AS contract_status,ld.id AS latest_document_id,e.created_at,
e.unit_id,u.name AS unit_name,u.sort_order AS unit_sort_order
FROM public.employees e LEFT JOIN fv ON fv.employee_id=e.id LEFT JOIN cur_contract c ON c.employee_id=e.id LEFT JOIN latest_doc ld ON ld.employee_id=e.id LEFT JOIN public.hr_units u ON u.id=e.unit_id;
GRANT SELECT ON public.employee_summary_view TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.reorder_hr_units(_ids uuid[]) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NOT private.can_write(auth.uid()) OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active AND (can_access_hr OR private.has_role(auth.uid(),'admin'))) THEN RAISE EXCEPTION 'Bạn không có quyền sắp xếp đầu mục.'; END IF;
 UPDATE public.hr_units u SET sort_order=x.n FROM unnest(_ids) WITH ORDINALITY x(id,n) WHERE u.id=x.id;
END $$;
REVOKE ALL ON FUNCTION public.reorder_hr_units(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reorder_hr_units(uuid[]) TO authenticated;