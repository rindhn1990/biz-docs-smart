ALTER TABLE public.export_history
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_export_history_contract ON public.export_history(contract_id);
CREATE INDEX IF NOT EXISTS idx_export_history_payment ON public.export_history(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_contract ON public.payments(contract_id);