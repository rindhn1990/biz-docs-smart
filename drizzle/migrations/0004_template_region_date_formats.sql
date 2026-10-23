ALTER TABLE public.template_mappings ADD COLUMN date_format text DEFAULT NULL;
ALTER TABLE public.template_mappings ADD CONSTRAINT template_mappings_date_format_check CHECK (date_format IS NULL OR date_format IN ('slash','vn_full','vn_full_short','vn_no_prefix'));
COMMENT ON COLUMN public.template_mappings.date_format IS 'Per-region Word date display. NULL preserves existing source date text.';
WITH candidates AS (
 SELECT id, regexp_match(trim(label), '^(ngày[[:space:]]+)?([0-9]{1,2})[[:space:]]+tháng[[:space:]]+([0-9]{1,2})[[:space:]]+năm[[:space:]]+([0-9]{4})$', 'i') AS full_parts,
 regexp_match(trim(label), '^([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})$') AS slash_parts
 FROM public.template_mappings WHERE date_format IS NULL AND source_field ~* '(^|[.])(date_|.*_date$|.*_ngay$)'
), parsed AS (
 SELECT id,full_parts,slash_parts, COALESCE(full_parts[2],slash_parts[1])::int AS d, COALESCE(full_parts[3],slash_parts[2])::int AS m, COALESCE(full_parts[4],slash_parts[3])::int AS y FROM candidates
), valid AS (
 SELECT *, CASE WHEN y BETWEEN 1 AND 9999 AND m BETWEEN 1 AND 12 THEN d BETWEEN 1 AND EXTRACT(DAY FROM (make_date(y,m,1) + interval '1 month - 1 day')) ELSE false END AS ok FROM parsed
)
UPDATE public.template_mappings tm SET date_format = CASE WHEN v.slash_parts IS NOT NULL THEN 'slash' WHEN v.full_parts[1] IS NULL THEN 'vn_no_prefix' WHEN length(v.full_parts[2]) = 2 AND length(v.full_parts[3]) = 2 THEN 'vn_full' ELSE 'vn_full_short' END
FROM valid v WHERE tm.id=v.id AND v.ok;