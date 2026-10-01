CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.can_write(uuid) SET SCHEMA private;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.can_write(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_write(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_profile_is_active()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT private.has_role(auth.uid(), 'admin') THEN
      NEW.is_active := OLD.is_active;
    END IF;
    IF NEW.can_access_tender IS DISTINCT FROM OLD.can_access_tender AND NOT private.has_role(auth.uid(), 'admin') THEN
      NEW.can_access_tender := OLD.can_access_tender;
    END IF;
    IF NEW.can_access_hr IS DISTINCT FROM OLD.can_access_hr AND NOT private.has_role(auth.uid(), 'admin') THEN
      NEW.can_access_hr := OLD.can_access_hr;
    END IF;
    IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
      IF NOT (OLD.must_change_password = true AND NEW.must_change_password = false AND auth.uid() = OLD.id)
         AND NOT private.has_role(auth.uid(), 'admin') THEN
        NEW.must_change_password := OLD.must_change_password;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;