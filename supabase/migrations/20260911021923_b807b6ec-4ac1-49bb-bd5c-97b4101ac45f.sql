ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS method text;

ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_method_check;
ALTER TABLE public.templates ADD CONSTRAINT templates_method_check CHECK (
  method IS NULL OR method IN (
    'chi_dinh_thau_rut_gon',
    'dam_phan_truc_tiep',
    'chao_hang_canh_tranh_rut_gon',
    'chao_hang_canh_tranh_thong_thuong',
    'dau_thau_rong_rai_2_tui'
  )
);

CREATE INDEX IF NOT EXISTS templates_method_idx ON public.templates (method);

UPDATE public.templates SET method = 'chi_dinh_thau_rut_gon' WHERE name = 'Tờ trình phê duyệt KHLCNT';