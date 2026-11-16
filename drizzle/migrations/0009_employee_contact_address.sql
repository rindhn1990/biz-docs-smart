ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS address text;
COMMENT ON COLUMN public.employees.address IS 'Employee contact address, independent of hometown';
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_viewdef('public.employee_summary_view'::regclass, true) INTO definition;
  EXECUTE format('CREATE OR REPLACE VIEW public.employee_summary_view WITH (security_invoker = true) AS SELECT summary.*, employee.address FROM (%s) summary JOIN public.employees employee ON employee.id = summary.id', rtrim(definition, E';\n '));
END $$;