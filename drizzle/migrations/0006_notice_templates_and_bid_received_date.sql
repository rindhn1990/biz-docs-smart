ALTER TABLE public.tender_contractors ADD COLUMN IF NOT EXISTS bid_received_date date;
COMMENT ON COLUMN public.tender_contractors.bid_received_date IS 'Ngày nhận hồ sơ của nhà thầu trong gói; nullable, governed by existing can_write UPDATE policy.';
ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_module_check;
ALTER TABLE public.templates ADD CONSTRAINT templates_module_check CHECK (module IN ('tender','hr','payment','notice'));