ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE TABLE public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_email text NOT NULL,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.password_reset_requests TO service_role;

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX password_reset_requests_email_created_idx
  ON public.password_reset_requests (normalized_email, created_at DESC);
CREATE INDEX password_reset_requests_ip_created_idx
  ON public.password_reset_requests (ip_hash, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_profile_is_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active
       AND NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.is_active := OLD.is_active;
    END IF;
    IF NEW.can_access_tender IS DISTINCT FROM OLD.can_access_tender
       AND NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.can_access_tender := OLD.can_access_tender;
    END IF;
    IF NEW.can_access_hr IS DISTINCT FROM OLD.can_access_hr
       AND NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.can_access_hr := OLD.can_access_hr;
    END IF;
    IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
      IF NOT (
        OLD.must_change_password = true
        AND NEW.must_change_password = false
        AND auth.uid() = OLD.id
      ) AND NOT public.has_role(auth.uid(), 'admin') THEN
        NEW.must_change_password := OLD.must_change_password;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.profiles
  SET must_change_password = false
  WHERE id = auth.uid();
END; $$;

REVOKE ALL ON FUNCTION public.complete_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated, service_role;