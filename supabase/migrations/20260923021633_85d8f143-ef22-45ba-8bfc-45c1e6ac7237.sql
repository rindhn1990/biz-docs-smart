ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_access_tender boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_access_hr boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.guard_profile_is_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      NEW.is_active := OLD.is_active;
    END IF;
    IF NEW.can_access_tender IS DISTINCT FROM OLD.can_access_tender THEN
      NEW.can_access_tender := OLD.can_access_tender;
    END IF;
    IF NEW.can_access_hr IS DISTINCT FROM OLD.can_access_hr THEN
      NEW.can_access_hr := OLD.can_access_hr;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;