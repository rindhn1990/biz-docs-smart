import { FileText, FileSpreadsheet, ScanLine, FileType2, File } from "lucide-react";

/** Phân loại tệp để chọn biểu tượng: pdf, pdf scan, word, excel, khác. */
export function fileKind(mime: string | null | undefined, name: string, pageCount?: number | null) {
  const lower = (name ?? "").toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    return (pageCount ?? 0) > 10 ? "pdf-scan" : "pdf";
  }
  if (lower.endsWith(".doc") || lower.endsWith(".docx") || (mime ?? "").includes("word"))
    return "word";
  if (
    lower.endsWith(".xls") ||
    lower.endsWith(".xlsx") ||
    (mime ?? "").includes("sheet") ||
    (mime ?? "").includes("excel")
  )
    return "excel";
  if ((mime ?? "").startsWith("image/")) return "pdf-scan";
  return "other";
}

const KIND_LABEL: Record<string, string> = {
  pdf: "PDF",
  "pdf-scan": "PDF scan",
  word: "Word",
  excel: "Excel",
  other: "Khác",
};

export function FileTypeIcon({
  mime,
  name,
  pageCount,
}: {
  mime: string | null | undefined;
  name: string;
  pageCount?: number | null;
}) {
  const kind = fileKind(mime, name, pageCount);
  const common = "size-4 shrink-0";

  const icon =
    kind === "pdf" ? (
      <FileText className={`${common} text-destructive`} />
    ) : kind === "pdf-scan" ? (
      <ScanLine className={`${common} text-warning-foreground`} />
    ) : kind === "word" ? (
      <FileType2 className={`${common} text-info`} />
    ) : kind === "excel" ? (
      <FileSpreadsheet className={`${common} text-success`} />
    ) : (
      <File className={`${common} text-muted-foreground`} />
    );

  return (
    <span className="inline-flex items-center gap-1.5" title={KIND_LABEL[kind]}>
      {icon}
      <span className="sr-only">{KIND_LABEL[kind]}</span>
    </span>
  );
}

export { KIND_LABEL };
