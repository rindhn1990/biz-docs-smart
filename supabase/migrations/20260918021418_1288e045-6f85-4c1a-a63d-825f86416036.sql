CREATE TABLE public.export_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tender_id uuid REFERENCES public.tenders(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  template_name text,
  file_name text NOT NULL,
  module text NOT NULL DEFAULT 'tender',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  exported_by uuid,
  exported_by_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.export_history TO authenticated;
GRANT ALL ON public.export_history TO service_role;

ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "export_history_select" ON public.export_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "export_history_insert" ON public.export_history FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "export_history_update" ON public.export_history FOR UPDATE TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "export_history_delete" ON public.export_history FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_export_history_tender ON public.export_history(tender_id);
CREATE INDEX idx_export_history_created ON public.export_history(created_at DESC);

CREATE TRIGGER trg_export_history_updated BEFORE UPDATE ON public.export_history
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
DECLARE t text;
DECLARE p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenders','tender_steps','tender_sources','tender_contractors','tender_data','document_fields','contractors','documents','payments'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND cmd='DELETE' LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t || '_delete_admin', t);
  END LOOP;
END $$;