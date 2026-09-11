ALTER TABLE public.tenders ADD COLUMN IF NOT EXISTS method text;

CREATE TABLE public.workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  doc_type text,
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_steps TO authenticated;
GRANT ALL ON public.workflow_steps TO service_role;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflow_steps_read ON public.workflow_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY workflow_steps_insert ON public.workflow_steps FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY workflow_steps_update ON public.workflow_steps FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY workflow_steps_delete ON public.workflow_steps FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_workflow_steps_method ON public.workflow_steps(method, sort_order);
CREATE TRIGGER trg_workflow_steps_updated BEFORE UPDATE ON public.workflow_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tender_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  doc_type text,
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tender_steps TO authenticated;
GRANT ALL ON public.tender_steps TO service_role;
ALTER TABLE public.tender_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY tender_steps_read ON public.tender_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY tender_steps_insert ON public.tender_steps FOR INSERT TO authenticated WITH CHECK (can_write(auth.uid()));
CREATE POLICY tender_steps_update ON public.tender_steps FOR UPDATE TO authenticated USING (can_write(auth.uid())) WITH CHECK (can_write(auth.uid()));
CREATE POLICY tender_steps_delete ON public.tender_steps FOR DELETE TO authenticated USING (can_write(auth.uid()));
CREATE INDEX idx_tender_steps_tender ON public.tender_steps(tender_id, sort_order);
CREATE TRIGGER trg_tender_steps_updated BEFORE UPDATE ON public.tender_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tender_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL UNIQUE REFERENCES public.tenders(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tender_data TO authenticated;
GRANT ALL ON public.tender_data TO service_role;
ALTER TABLE public.tender_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY tender_data_read ON public.tender_data FOR SELECT TO authenticated USING (true);
CREATE POLICY tender_data_insert ON public.tender_data FOR INSERT TO authenticated WITH CHECK (can_write(auth.uid()));
CREATE POLICY tender_data_update ON public.tender_data FOR UPDATE TO authenticated USING (can_write(auth.uid())) WITH CHECK (can_write(auth.uid()));
CREATE POLICY tender_data_delete ON public.tender_data FOR DELETE TO authenticated USING (can_write(auth.uid()));
CREATE TRIGGER trg_tender_data_updated BEFORE UPDATE ON public.tender_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tax_code text,
  address text,
  representative text,
  representative_title text,
  phone text,
  email text,
  bank_account text,
  bank_name text,
  source text NOT NULL DEFAULT 'nhap_tay',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractors TO authenticated;
GRANT ALL ON public.contractors TO service_role;
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY contractors_read ON public.contractors FOR SELECT TO authenticated USING (true);
CREATE POLICY contractors_insert ON public.contractors FOR INSERT TO authenticated WITH CHECK (can_write(auth.uid()));
CREATE POLICY contractors_update ON public.contractors FOR UPDATE TO authenticated USING (can_write(auth.uid())) WITH CHECK (can_write(auth.uid()));
CREATE POLICY contractors_delete ON public.contractors FOR DELETE TO authenticated USING (can_write(auth.uid()));
CREATE TRIGGER trg_contractors_updated BEFORE UPDATE ON public.contractors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tender_contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'quote',
  price numeric,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (tender_id, contractor_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tender_contractors TO authenticated;
GRANT ALL ON public.tender_contractors TO service_role;
ALTER TABLE public.tender_contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY tender_contractors_read ON public.tender_contractors FOR SELECT TO authenticated USING (true);
CREATE POLICY tender_contractors_insert ON public.tender_contractors FOR INSERT TO authenticated WITH CHECK (can_write(auth.uid()));
CREATE POLICY tender_contractors_update ON public.tender_contractors FOR UPDATE TO authenticated USING (can_write(auth.uid())) WITH CHECK (can_write(auth.uid()));
CREATE POLICY tender_contractors_delete ON public.tender_contractors FOR DELETE TO authenticated USING (can_write(auth.uid()));
CREATE INDEX idx_tender_contractors_tender ON public.tender_contractors(tender_id, role, sort_order);
CREATE TRIGGER trg_tender_contractors_updated BEFORE UPDATE ON public.tender_contractors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tender_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  category text NOT NULL,
  file_name text NOT NULL,
  storage_path text,
  mime_type text,
  file_size bigint,
  status text NOT NULL DEFAULT 'uploaded',
  parsed jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tender_sources TO authenticated;
GRANT ALL ON public.tender_sources TO service_role;
ALTER TABLE public.tender_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY tender_sources_read ON public.tender_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY tender_sources_insert ON public.tender_sources FOR INSERT TO authenticated WITH CHECK (can_write(auth.uid()));
CREATE POLICY tender_sources_update ON public.tender_sources FOR UPDATE TO authenticated USING (can_write(auth.uid())) WITH CHECK (can_write(auth.uid()));
CREATE POLICY tender_sources_delete ON public.tender_sources FOR DELETE TO authenticated USING (can_write(auth.uid()));
CREATE INDEX idx_tender_sources_tender ON public.tender_sources(tender_id, category);
CREATE TRIGGER trg_tender_sources_updated BEFORE UPDATE ON public.tender_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();