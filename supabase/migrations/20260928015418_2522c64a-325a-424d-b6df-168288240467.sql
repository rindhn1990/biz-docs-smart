ALTER TABLE public.password_reset_requests
  ADD COLUMN IF NOT EXISTS counted boolean NOT NULL DEFAULT true;

CREATE INDEX password_reset_requests_counted_created_idx
  ON public.password_reset_requests (normalized_email, counted, created_at DESC);