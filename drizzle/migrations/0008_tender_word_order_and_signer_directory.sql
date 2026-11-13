CREATE TABLE public.tender_template_order (
 tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
 template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
 sort_order integer NOT NULL DEFAULT 0,
 PRIMARY KEY (tender_id, template_id)
);
GRANT SELECT, INSERT, UPDATE ON public.tender_template_order TO authenticated;
GRANT ALL ON public.tender_template_order TO service_role;
ALTER TABLE public.tender_template_order ENABLE ROW LEVEL SECURITY;
CREATE POLICY tender_template_order_read ON public.tender_template_order FOR SELECT TO authenticated USING (private.can_tender(auth.uid()));
CREATE POLICY tender_template_order_insert ON public.tender_template_order FOR INSERT TO authenticated WITH CHECK (private.can_tender(auth.uid()) AND private.can_write(auth.uid()));
CREATE POLICY tender_template_order_update ON public.tender_template_order FOR UPDATE TO authenticated USING (private.can_tender(auth.uid()) AND private.can_write(auth.uid())) WITH CHECK (private.can_tender(auth.uid()) AND private.can_write(auth.uid()));
CREATE TABLE public.tender_signers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) > 0),
 authorization_number text NOT NULL DEFAULT '',
 authorization_date text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tender_signers TO authenticated;
GRANT ALL ON public.tender_signers TO service_role;
ALTER TABLE public.tender_signers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tender_signers_read ON public.tender_signers FOR SELECT TO authenticated USING (private.can_tender(auth.uid()));
CREATE POLICY tender_signers_insert ON public.tender_signers FOR INSERT TO authenticated WITH CHECK (private.can_tender(auth.uid()) AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY tender_signers_update ON public.tender_signers FOR UPDATE TO authenticated USING (private.can_tender(auth.uid()) AND private.has_role(auth.uid(), 'admin')) WITH CHECK (private.can_tender(auth.uid()) AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY tender_signers_delete ON public.tender_signers FOR DELETE TO authenticated USING (private.can_tender(auth.uid()) AND private.has_role(auth.uid(), 'admin'));
COMMENT ON TABLE public.tender_template_order IS 'Per-tender Word export ordering, independent of the shared template order.';
COMMENT ON TABLE public.tender_signers IS 'Shared tender signer directory; choosing a signer copies authorization values into tender_data, preserving existing tender snapshots.';