ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS contractor_id uuid REFERENCES public.contractors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_contractor ON public.contracts(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_tender ON public.contracts(tender_id);