CREATE INDEX IF NOT EXISTS idx_emp_docs_employee ON public.employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_doc_fields_doc_key ON public.employee_document_fields(document_id, field_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_emp_contracts_employee ON public.employee_contracts(employee_id, end_date DESC);
CREATE INDEX IF NOT EXISTS idx_employees_full_name ON public.employees(full_name);

-- Một dòng / nhân viên. Giá trị trường lấy bản mới nhất (updated_at, created_at) trên mọi hồ sơ của nhân viên.
-- Hợp đồng chọn: ưu tiên status='active', sau đó end_date xa nhất (NULL = không thời hạn xếp trước), rồi start_date mới nhất.
CREATE OR REPLACE VIEW public.employee_summary_view
WITH (security_invoker = true) AS
WITH latest_fields AS (
  SELECT DISTINCT ON (d.employee_id, f.field_key)
    d.employee_id, f.field_key, NULLIF(trim(f.value), '') AS value, d.id AS document_id
  FROM public.employee_document_fields f
  JOIN public.employee_documents d ON d.id = f.document_id
  WHERE d.employee_id IS NOT NULL AND NULLIF(trim(f.value), '') IS NOT NULL
  ORDER BY d.employee_id, f.field_key, f.updated_at DESC, f.created_at DESC
),
fv AS (
  SELECT employee_id, jsonb_object_agg(field_key, value) AS v
  FROM latest_fields GROUP BY employee_id
),
latest_doc AS (
  SELECT DISTINCT ON (employee_id) employee_id, id
  FROM public.employee_documents WHERE employee_id IS NOT NULL
  ORDER BY employee_id, created_at DESC
),
cur_contract AS (
  SELECT DISTINCT ON (employee_id) *
  FROM public.employee_contracts WHERE employee_id IS NOT NULL
  ORDER BY employee_id, (status = 'active') DESC, end_date DESC NULLS FIRST, start_date DESC NULLS LAST
)
SELECT
  e.id,
  e.full_name,
  COALESCE(to_char(e.date_of_birth, 'DD/MM/YYYY'), fv.v->>'date_of_birth') AS date_of_birth,
  COALESCE(e.id_number, fv.v->>'id_number') AS id_number,
  COALESCE(to_char(e.id_issue_date, 'DD/MM/YYYY'), fv.v->>'id_issue_date') AS id_issue_date,
  COALESCE(e.id_issue_place, fv.v->>'id_issue_place') AS id_issue_place,
  COALESCE(e.hometown, fv.v->>'hometown') AS hometown,
  COALESCE(c.position, e.position, fv.v->>'position') AS position,
  COALESCE(e.department, fv.v->>'department') AS department,
  COALESCE(e.degree_name, fv.v->>'degree_name') AS degree_name,
  COALESCE(e.degree_major, fv.v->>'degree_major') AS degree_major,
  COALESCE(e.degree_school, fv.v->>'degree_school') AS degree_school,
  c.id AS contract_id,
  c.contract_number,
  c.contract_type,
  c.base_salary,
  c.start_date,
  c.end_date,
  c.status AS contract_status,
  ld.id AS latest_document_id,
  e.created_at
FROM public.employees e
LEFT JOIN fv ON fv.employee_id = e.id
LEFT JOIN cur_contract c ON c.employee_id = e.id
LEFT JOIN latest_doc ld ON ld.employee_id = e.id;

GRANT SELECT ON public.employee_summary_view TO authenticated;
GRANT SELECT ON public.employee_summary_view TO service_role;