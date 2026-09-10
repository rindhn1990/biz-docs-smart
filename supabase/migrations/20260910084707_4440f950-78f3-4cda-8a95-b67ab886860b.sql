CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  id_number text,
  id_issue_date date,
  id_issue_place text,
  date_of_birth date,
  hometown text,
  degree_name text,
  degree_major text,
  degree_issue_date date,
  degree_school text,
  position text,
  department text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_select" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees_insert" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "employees_update" ON public.employees FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "employees_delete" ON public.employees FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.employee_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_number text NOT NULL,
  contract_type text,
  position text,
  start_date date,
  end_date date,
  base_salary numeric,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','completed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_contracts TO authenticated;
GRANT ALL ON public.employee_contracts TO service_role;
ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_contracts_select" ON public.employee_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "employee_contracts_insert" ON public.employee_contracts FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "employee_contracts_update" ON public.employee_contracts FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "employee_contracts_delete" ON public.employee_contracts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_employee_contracts_updated BEFORE UPDATE ON public.employee_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  doc_type text NOT NULL CHECK (doc_type IN ('quyet_dinh_bo_nhiem','cccd','bang_cap')),
  mime_type text,
  page_count integer,
  file_size bigint,
  status public.doc_status NOT NULL DEFAULT 'new',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_documents_select" ON public.employee_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "employee_documents_insert" ON public.employee_documents FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "employee_documents_update" ON public.employee_documents FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "employee_documents_delete" ON public.employee_documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_employee_documents_updated BEFORE UPDATE ON public.employee_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.employee_document_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.employee_documents(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  value text,
  confidence numeric NOT NULL DEFAULT 0,
  needs_review boolean NOT NULL DEFAULT false,
  source_page integer,
  bbox_top numeric,
  bbox_left numeric,
  bbox_width numeric,
  bbox_height numeric,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
CREATE INDEX idx_employee_document_fields_doc ON public.employee_document_fields(document_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_document_fields TO authenticated;
GRANT ALL ON public.employee_document_fields TO service_role;
ALTER TABLE public.employee_document_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_document_fields_select" ON public.employee_document_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "employee_document_fields_insert" ON public.employee_document_fields FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "employee_document_fields_update" ON public.employee_document_fields FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "employee_document_fields_delete" ON public.employee_document_fields FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_employee_document_fields_updated BEFORE UPDATE ON public.employee_document_fields FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();