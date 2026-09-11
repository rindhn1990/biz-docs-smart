ALTER TABLE public.templates
ADD COLUMN module text NOT NULL DEFAULT 'tender';

UPDATE public.templates
SET module = 'hr'
WHERE lower(coalesce(category, '')) LIKE '%nhân sự%'
   OR lower(coalesce(category, '')) LIKE '%nhan su%'
   OR lower(name) LIKE '%hợp đồng lao động%'
   OR lower(name) LIKE '%hop dong lao dong%';

ALTER TABLE public.templates
ADD CONSTRAINT templates_module_check CHECK (module IN ('tender', 'hr'));

CREATE INDEX idx_templates_module_method ON public.templates(module, method);