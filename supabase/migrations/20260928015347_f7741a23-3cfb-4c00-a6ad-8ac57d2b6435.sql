CREATE POLICY password_reset_requests_deny_authenticated
ON public.password_reset_requests
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.profiles
  SET must_change_password = false
  WHERE id = auth.uid() AND must_change_password = true;
END; $$;

REVOKE ALL ON FUNCTION public.complete_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;