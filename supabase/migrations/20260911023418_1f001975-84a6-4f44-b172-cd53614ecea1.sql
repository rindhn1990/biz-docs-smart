DROP POLICY IF EXISTS templates_insert ON public.templates;
DROP POLICY IF EXISTS templates_update ON public.templates;
CREATE POLICY templates_insert ON public.templates FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY templates_update ON public.templates FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS template_mappings_insert ON public.template_mappings;
DROP POLICY IF EXISTS template_mappings_update ON public.template_mappings;
CREATE POLICY template_mappings_insert ON public.template_mappings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY template_mappings_update ON public.template_mappings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));