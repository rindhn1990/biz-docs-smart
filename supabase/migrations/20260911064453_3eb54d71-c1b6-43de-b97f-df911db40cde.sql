ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_module_check;
ALTER TABLE public.templates ADD CONSTRAINT templates_module_check CHECK (module IN ('tender','hr','payment'));