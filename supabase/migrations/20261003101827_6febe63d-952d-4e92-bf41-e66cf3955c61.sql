ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
WITH o AS (SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM public.templates)
UPDATE public.templates t SET sort_order = o.rn FROM o WHERE o.id = t.id;
CREATE INDEX IF NOT EXISTS templates_sort_order_idx ON public.templates(sort_order);