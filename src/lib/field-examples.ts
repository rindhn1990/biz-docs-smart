import { isDateField } from "@/components/DateField";

export type ExampleMapping = { source_field: string | null; value: string | null };

/** Input is ordered newest first. Examples never enter the document value map. */
export function groupFieldExamples(rows: ExampleMapping[]) {
  const examples: Record<string, string> = {};
  const mappedKeys = new Set<string>();
  for (const row of rows) {
    if (!row.source_field) continue;
    mappedKeys.add(row.source_field);
    const value = row.value?.trim();
    if (value && !examples[row.source_field]) examples[row.source_field] = value;
  }
  return { examples, mappedKeys };
}

export function fieldExamplePlaceholder(key: string, label: string, group: string | null, example?: string) {
  if (example?.trim()) return `VD: ${example.trim().replace(/^VD:\s*/i, "")}`;
  if (isDateField(key, label)) return "VD: dd/mm/yyyy";
  if ((/_numb$/i.test(key) || /^Numb_/i.test(key)) && /tiền|giá|kinh phí|tài chính|thanh toán/i.test(`${label} ${group ?? ""}`)) {
    return "VD: 1.234.567.890";
  }
  return "Chưa đọc được — vui lòng nhập tay";
}