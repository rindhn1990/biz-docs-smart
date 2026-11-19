CREATE TABLE public.tender_center_field_order (
 method text NOT NULL, field_key text NOT NULL, sort_order integer NOT NULL,
 updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(method,field_key)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.tender_center_field_order TO authenticated;
GRANT ALL ON public.tender_center_field_order TO service_role;
ALTER TABLE public.tender_center_field_order ENABLE ROW LEVEL SECURITY;
CREATE POLICY center_order_read ON public.tender_center_field_order FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY center_order_insert ON public.tender_center_field_order FOR INSERT TO authenticated WITH CHECK (private.can_tender(auth.uid()) AND private.can_write(auth.uid()));
CREATE POLICY center_order_update ON public.tender_center_field_order FOR UPDATE TO authenticated USING (private.can_tender(auth.uid()) AND private.can_write(auth.uid())) WITH CHECK (private.can_tender(auth.uid()) AND private.can_write(auth.uid()));
CREATE POLICY center_order_delete ON public.tender_center_field_order FOR DELETE TO authenticated USING (private.can_tender(auth.uid()) AND private.can_write(auth.uid()));
CREATE TRIGGER center_order_updated BEFORE UPDATE ON public.tender_center_field_order FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
COMMENT ON TABLE public.tender_method_field_order IS 'DEPRECATED: replaced by tender_center_field_order; unused preliminary ordering configuration.';