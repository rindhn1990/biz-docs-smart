CREATE TABLE public.document_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
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
CREATE INDEX idx_document_fields_document ON public.document_fields(document_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_fields TO authenticated;
GRANT ALL ON public.document_fields TO service_role;
ALTER TABLE public.document_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_fields_select" ON public.document_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "document_fields_insert" ON public.document_fields FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "document_fields_update" ON public.document_fields FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "document_fields_delete" ON public.document_fields FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_document_fields_updated BEFORE UPDATE ON public.document_fields FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.template_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  placeholder text NOT NULL,
  label text NOT NULL,
  source_field text,
  value text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
CREATE INDEX idx_template_mappings_template ON public.template_mappings(template_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_mappings TO authenticated;
GRANT ALL ON public.template_mappings TO service_role;
ALTER TABLE public.template_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "template_mappings_select" ON public.template_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "template_mappings_insert" ON public.template_mappings FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "template_mappings_update" ON public.template_mappings FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "template_mappings_delete" ON public.template_mappings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_template_mappings_updated BEFORE UPDATE ON public.template_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();