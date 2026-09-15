import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  formatThousands,
  isMoneyNumberField,
  moneyTextKey,
  readVietnameseMoney,
} from "@/lib/money";

export type FieldRow = {
  id: string;
  document_id: string;
  field_key: string;
  label: string;
  value: string | null;
  confidence: number;
  needs_review: boolean;
  source_page: number | null;
  bbox_top: number | null;
  bbox_left: number | null;
  bbox_width: number | null;
  bbox_height: number | null;
  sort_order: number;
  field_group: string | null;
};

export function confidenceStyle(c: number) {
  const pct = Math.round(c * 100);
  if (pct >= 95)
    return { pct, cls: "border-success/30 bg-success/10 text-success", warn: false } as const;
  if (pct >= 85)
    return {
      pct,
      cls: "border-warning/45 bg-warning/18 text-warning-foreground",
      warn: false,
    } as const;
  return {
    pct,
    cls: "border-destructive/40 bg-destructive/12 text-destructive",
    warn: true,
  } as const;
}

/** Gom các trường theo field_group, xếp đúng thứ tự nghiệp vụ (Căn cứ → Khác). */
export function useGroupedFields(rows: FieldRow[]) {
  return useMemo<[string | null, FieldRow[]][]>(() => {
    if (!rows.some((f) => f.field_group)) return [[null, rows]];
    const map = new Map<string, FieldRow[]>();
    for (const f of rows) {
      const key = f.field_group ?? "Khác";
      const list = map.get(key);
      if (list) list.push(f);
      else map.set(key, [f]);
    }
    return [...map.entries()].sort((a, b) => groupOrder(a[0]) - groupOrder(b[0]));
  }, [rows]);
}

export function FieldGroupEditor({
  rows,
  readOnly,
  activeField,
  onFocusField,
  onChanged,
}: {
  rows: FieldRow[];
  readOnly: boolean;
  activeField?: string | null;
  onFocusField?: (id: string) => void;
  /** Cho phép sửa nhãn và xoá trường thủ công. */
  onChanged?: () => void;
}) {
  const grouped = useGroupedFields(rows);
  const byKey = useMemo(() => {
    const map = new Map<string, FieldRow>();
    for (const f of rows) map.set(f.field_key, f);
    return map;
  }, [rows]);
  return (
    <div className="divide-y divide-border">
      {grouped.map(([group, groupRows]) => (
        <div key={group ?? "all"} className="divide-y divide-border">
          {group ? (
            <h3 className="bg-muted/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </h3>
          ) : null}
          {groupRows.map((field) => (
            <FieldRowEditor
              key={field.id}
              field={field}
              textField={
                isMoneyNumberField(field.field_key, field.label)
                  ? (byKey.get(moneyTextKey(field.field_key)) ?? null)
                  : null
              }
              active={activeField === field.id}
              readOnly={readOnly}
              onFocusField={() => onFocusField?.(field.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function FieldRowEditor({
  field,
  active,
  readOnly,
  onFocusField,
  textField,
}: {
  field: FieldRow;
  active: boolean;
  readOnly: boolean;
  onFocusField: () => void;
  /** Trường "bằng chữ" đi kèm, sẽ tự điền khi nhập xong số tiền. */
  textField?: FieldRow | null;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(field.value ?? "");
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conf = confidenceStyle(Number(field.confidence));
  const isMoney = isMoneyNumberField(field.field_key, field.label) && !!textField;

  useEffect(() => setValue(field.value ?? ""), [field.value]);

  const save = async (next: string) => {
    if ((field.value ?? "") === next) return;
    setSaving(true);
    const { error } = await supabase
      .from("document_fields")
      .update({ value: next || null })
      .eq("id", field.id);

    /** Số tiền bằng chữ luôn bám theo số tiền bằng số vừa nhập. */
    if (!error && isMoney && textField) {
      const words = readVietnameseMoney(next);
      if ((textField.value ?? "") !== words) {
        await supabase
          .from("document_fields")
          .update({ value: words || null })
          .eq("id", textField.id);
      }
    }

    setSaving(false);
    if (error) {
      toast.error("Không lưu được thay đổi", { description: error.message });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["document_fields", field.document_id] });
  };

  return (
    <div
      onMouseEnter={onFocusField}
      onClick={onFocusField}
      className={`px-4 py-3 transition-colors ${active ? "bg-accent/70" : "hover:bg-accent/40"}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={field.id} className="text-xs font-medium text-muted-foreground">
          {field.label}
        </label>
        <span className="flex items-center gap-1.5">
          {saving ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${conf.cls}`}
          >
            {conf.pct}%{conf.warn ? " · Cần xác minh" : ""}
          </span>
        </span>
      </div>
      <input
        id={field.id}
        value={value}
        readOnly={readOnly}
        inputMode={isMoney ? "numeric" : undefined}
        placeholder={conf.warn ? "Chưa đọc được — vui lòng nhập tay" : "—"}
        onChange={(e) => {
          const next = isMoney ? formatThousands(e.target.value) : e.target.value;
          setValue(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void save(next), 800);
        }}
        onFocus={onFocusField}
        onBlur={() => {
          if (timer.current) clearTimeout(timer.current);
          void save(value);
        }}
        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30 read-only:bg-muted"
      />
      {isMoney && value ? (
        <p className="mt-1 text-[11px] italic text-muted-foreground">
          Bằng chữ: {readVietnameseMoney(value)}
        </p>
      ) : null}
    </div>
  );
}

