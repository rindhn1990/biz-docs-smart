-- Email liên hệ của nhân sự (dùng gửi thông báo lương)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_email_format;
ALTER TABLE public.employees ADD CONSTRAINT employees_email_format
  CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Lương theo kỳ (YYYY-MM), chỉ quản trị viên đọc/ghi
CREATE TABLE public.hr_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount numeric NOT NULL CHECK (amount >= 0),
  note text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','excel','contract')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_salaries TO authenticated;
GRANT ALL ON public.hr_salaries TO service_role;
ALTER TABLE public.hr_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY hr_salaries_admin ON public.hr_salaries FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- Mẫu email thông báo lương
CREATE TABLE public.hr_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_email_templates TO authenticated;
GRANT ALL ON public.hr_email_templates TO service_role;
ALTER TABLE public.hr_email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY hr_email_templates_admin ON public.hr_email_templates FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- Nhật ký gửi thư (không lưu nội dung thư, không lưu khoá API)
CREATE TABLE public.hr_salary_mail_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_name text,
  email text,
  period text,
  template_id uuid,
  subject text,
  amount numeric,
  kind text NOT NULL DEFAULT 'real' CHECK (kind IN ('real','test')),
  status text NOT NULL CHECK (status IN ('sent','failed')),
  error text,
  provider_id text,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_salary_mail_log TO authenticated;
GRANT ALL ON public.hr_salary_mail_log TO service_role;
ALTER TABLE public.hr_salary_mail_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY hr_salary_mail_log_admin ON public.hr_salary_mail_log FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
-- Chặn gửi trùng ở mức cơ sở dữ liệu: mỗi nhân sự tối đa 1 thư THẬT thành công mỗi kỳ
CREATE UNIQUE INDEX hr_salary_mail_log_sent_once
  ON public.hr_salary_mail_log (employee_id, period)
  WHERE kind = 'real' AND status = 'sent' AND employee_id IS NOT NULL;

-- Bổ sung email vào bảng tổng hợp nhân sự
CREATE OR REPLACE VIEW public.employee_summary_view
WITH (security_invoker = true) AS
WITH latest_fields AS (
  SELECT DISTINCT ON (d.employee_id, f.field_key) d.employee_id,
    f.field_key,
    NULLIF(btrim(f.value), ''::text) AS value,
    d.id AS document_id
  FROM employee_document_fields f
  JOIN employee_documents d ON d.id = f.document_id
  WHERE d.employee_id IS NOT NULL AND NULLIF(btrim(f.value), ''::text) IS NOT NULL
  ORDER BY d.employee_id, f.field_key, f.updated_at DESC, f.created_at DESC
), fv AS (
  SELECT latest_fields.employee_id,
    jsonb_object_agg(latest_fields.field_key, latest_fields.value) AS v
  FROM latest_fields
  GROUP BY latest_fields.employee_id
), latest_doc AS (
  SELECT DISTINCT ON (employee_documents.employee_id) employee_documents.employee_id,
    employee_documents.id
  FROM employee_documents
  WHERE employee_documents.employee_id IS NOT NULL
  ORDER BY employee_documents.employee_id, employee_documents.created_at DESC
), cur_contract AS (
  SELECT DISTINCT ON (employee_contracts.employee_id) employee_contracts.id,
    employee_contracts.employee_id,
    employee_contracts.contract_number,
    employee_contracts.contract_type,
    employee_contracts."position",
    employee_contracts.start_date,
    employee_contracts.end_date,
    employee_contracts.base_salary,
    employee_contracts.status,
    employee_contracts.notes,
    employee_contracts.created_at,
    employee_contracts.updated_at,
    employee_contracts.created_by,
    employee_contracts.updated_by
  FROM employee_contracts
  WHERE employee_contracts.employee_id IS NOT NULL
  ORDER BY employee_contracts.employee_id, (employee_contracts.status = 'active'::text) DESC, employee_contracts.end_date DESC, employee_contracts.start_date DESC NULLS LAST
)
SELECT e.id,
  e.full_name,
  COALESCE(to_char(e.date_of_birth::timestamp with time zone, 'DD/MM/YYYY'::text), fv.v ->> 'date_of_birth'::text) AS date_of_birth,
  COALESCE(e.id_number, fv.v ->> 'id_number'::text) AS id_number,
  COALESCE(to_char(e.id_issue_date::timestamp with time zone, 'DD/MM/YYYY'::text), fv.v ->> 'id_issue_date'::text) AS id_issue_date,
  COALESCE(e.id_issue_place, fv.v ->> 'id_issue_place'::text) AS id_issue_place,
  COALESCE(e.hometown, fv.v ->> 'hometown'::text) AS hometown,
  COALESCE(c."position", e."position", fv.v ->> 'position'::text) AS "position",
  COALESCE(e.department, fv.v ->> 'department'::text) AS department,
  COALESCE(e.degree_name, fv.v ->> 'degree_name'::text) AS degree_name,
  COALESCE(e.degree_major, fv.v ->> 'degree_major'::text) AS degree_major,
  COALESCE(e.degree_school, fv.v ->> 'degree_school'::text) AS degree_school,
  c.id AS contract_id,
  c.contract_number,
  c.contract_type,
  c.base_salary,
  c.start_date,
  c.end_date,
  c.status AS contract_status,
  ld.id AS latest_document_id,
  e.created_at,
  e.unit_id,
  u.name AS unit_name,
  u.sort_order AS unit_sort_order,
  e.email
FROM employees e
LEFT JOIN fv ON fv.employee_id = e.id
LEFT JOIN cur_contract c ON c.employee_id = e.id
LEFT JOIN latest_doc ld ON ld.employee_id = e.id
LEFT JOIN hr_units u ON u.id = e.unit_id;