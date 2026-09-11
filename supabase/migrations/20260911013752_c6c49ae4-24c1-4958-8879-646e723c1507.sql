ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS doc_type text;
ALTER TABLE public.document_fields ADD COLUMN IF NOT EXISTS field_group text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS source_docx_path text;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS delimiter_style text NOT NULL DEFAULT 'curly';
ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_delimiter_style_check;
ALTER TABLE public.templates ADD CONSTRAINT templates_delimiter_style_check CHECK (delimiter_style IN ('curly','square'));
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON public.documents(doc_type);