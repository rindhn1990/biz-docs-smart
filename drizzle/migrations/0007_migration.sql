CREATE OR REPLACE FUNCTION private.is_active_user(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND is_active) $$;
CREATE OR REPLACE FUNCTION private.can_tender(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND is_active AND (can_access_tender OR private.has_role(_uid,'admin'))) $$;
CREATE OR REPLACE FUNCTION private.can_hr(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND is_active AND (can_access_hr OR private.has_role(_uid,'admin'))) $$;
GRANT EXECUTE ON FUNCTION private.is_active_user(uuid), private.can_tender(uuid), private.can_hr(uuid) TO authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('projects','projects_read','private.can_tender(auth.uid())'),
    ('tenders','tenders_read','private.can_tender(auth.uid())'),
    ('contractors','contractors_read','private.can_tender(auth.uid())'),
    ('customers','customers_read','private.can_tender(auth.uid())'),
    ('contracts','contracts_read','private.can_tender(auth.uid())'),
    ('payments','payments_read','private.can_tender(auth.uid())'),
    ('tender_contractors','tender_contractors_read','private.can_tender(auth.uid())'),
    ('tender_data','tender_data_read','private.can_tender(auth.uid())'),
    ('tender_sources','tender_sources_read','private.can_tender(auth.uid())'),
    ('tender_steps','tender_steps_read','private.can_tender(auth.uid())'),
    ('documents','documents_read','private.can_tender(auth.uid())'),
    ('document_fields','document_fields_select','private.can_tender(auth.uid())'),
    ('document_extractions','document_extractions_read','private.can_tender(auth.uid())'),
    ('workflow_events','workflow_events_read','private.can_tender(auth.uid())'),
    ('employees','employees_select','private.can_hr(auth.uid())'),
    ('employee_documents','employee_documents_select','private.can_hr(auth.uid())'),
    ('employee_document_fields','employee_document_fields_select','private.can_hr(auth.uid())'),
    ('employee_contracts','employee_contracts_select','private.can_hr(auth.uid())'),
    ('templates','templates_read','private.is_active_user(auth.uid())'),
    ('template_fields','template_fields_read','private.is_active_user(auth.uid())'),
    ('template_mappings','template_mappings_select','private.is_active_user(auth.uid())'),
    ('document_types','document_types_read','private.is_active_user(auth.uid())'),
    ('workflow_steps','workflow_steps_read','private.is_active_user(auth.uid())'),
    ('app_settings','app_settings_read','private.is_active_user(auth.uid())'),
    ('export_history','export_history_select','private.is_active_user(auth.uid())'),
    ('audit_logs','audit_logs_read','private.has_role(auth.uid(),''admin'')'),
    ('notifications','notifications_read','(user_id = auth.uid() OR (user_id IS NULL AND private.is_active_user(auth.uid())))'),
    ('profiles','profiles_read','(id = auth.uid() OR private.is_active_user(auth.uid()))'),
    ('user_roles','roles_read','(user_id = auth.uid() OR private.has_role(auth.uid(),''admin''))')
  ) AS t(tbl,pol,expr) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', r.pol, r.tbl, r.expr);
  END LOOP;
END $$;

DROP POLICY IF EXISTS storage_read ON storage.objects;
CREATE POLICY storage_read ON storage.objects FOR SELECT TO authenticated USING (
  (bucket_id = 'templates' AND private.is_active_user(auth.uid()))
  OR (bucket_id = 'documents' AND (private.can_tender(auth.uid()) OR private.can_hr(auth.uid())))
);