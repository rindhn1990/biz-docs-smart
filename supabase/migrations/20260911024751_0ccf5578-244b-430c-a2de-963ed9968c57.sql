DROP POLICY IF EXISTS "templates_delete_admin" ON public.templates;
CREATE POLICY "templates_delete_admin" ON public.templates FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "template_mappings_delete_admin" ON public.template_mappings;
CREATE POLICY "template_mappings_delete_admin" ON public.template_mappings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));