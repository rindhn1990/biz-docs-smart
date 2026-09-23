import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { groupHeading, groupOrder } from "@/lib/khlcnt";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { DateField, isDateField } from "@/components/DateField";
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
  onRenameGroup,
  onDeleteGroup,
}: {
  rows: FieldRow[];
  readOnly: boolean;
  activeField?: string | null;
  onFocusField?: (id: string) => void;
  /** Cho phép sửa nhãn và xoá trường thủ công. */
  onChanged?: (() => void) | undefined;
  /** Đổi tên nhóm lớn (cập nhật cho toàn bộ trường trong nhóm). */
  onRenameGroup?: ((oldName: string, newName: string) => void | Promise<void>) | undefined;
  /** Xoá cả nhóm lớn cùng toàn bộ trường bên trong. */
  onDeleteGroup?: ((name: string, count: number) => void | Promise<void>) | undefined;
}) {
  const grouped = useGroupedFields(rows);
  const { isAdmin } = useAuth();
  /** Số tiền bằng chữ hiển thị ngay khi người dùng đang gõ ở ô số tiền. */
  const [liveWords, setLiveWords] = useState<Record<string, string>>({});
  const byKey = useMemo(() => {
    const map = new Map<string, FieldRow>();
    for (const f of rows) map.set(f.field_key, f);
    return map;
  }, [rows]);
  const textFieldIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of rows) {
      if (!isMoneyNumberField(f.field_key, f.label)) continue;
      const paired = byKey.get(moneyTextKey(f.field_key));
      if (paired && paired.id !== f.id) ids.add(paired.id);
    }
    return ids;
  }, [rows, byKey]);

  const publishWords = useCallback((textFieldId: string, words: string) => {
    setLiveWords((prev) => (prev[textFieldId] === words ? prev : { ...prev, [textFieldId]: words }));
  }, []);

  return (
    <div className="divide-y divide-border">
      {grouped.map(([group, groupRows], gi) => (
        <div key={group ?? "all"} className="divide-y divide-border">
          {group ? (
            <GroupHeading
              name={group}
              heading={groupHeading(group, gi)}
              count={groupRows.length}
              canManage={isAdmin}
              onRenameGroup={onRenameGroup}
              onDeleteGroup={onDeleteGroup}
            />
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
              derivedValue={textFieldIds.has(field.id) ? (liveWords[field.id] ?? null) : null}
              autoFilled={textFieldIds.has(field.id)}
              onWords={publishWords}
              active={activeField === field.id}
              readOnly={readOnly}
              onFocusField={() => onFocusField?.(field.id)}
              onChanged={onChanged}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Tiêu đề nhóm lớn kèm nút đổi tên và xoá nhóm (chỉ quản trị viên). */
function GroupHeading({
  name,
  heading,
  count,
  canManage,
  onRenameGroup,
  onDeleteGroup,
}: {
  name: string;
  heading: string;
  count: number;
  canManage: boolean;
  onRenameGroup?: ((oldName: string, newName: string) => void | Promise<void>) | undefined;
  onDeleteGroup?: ((name: string, count: number) => void | Promise<void>) | undefined;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);

  useEffect(() => setDraft(name), [name]);

  const commit = () => {
    setRenaming(false);
    const next = draft.trim();
    if (!next || next === name) {
      setDraft(name);
      return;
    }
    void onRenameGroup?.(name, next);
  };

  return (
    <div className="flex items-center gap-2 bg-muted/60 px-4 py-2">
      {renaming ? (
        <input
          value={draft}
          autoFocus
          aria-label={`Tên nhóm ${name}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(name);
              setRenaming(false);
            }
          }}
          className="w-full max-w-xs rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:border-primary"
        />
      ) : (
        <h3 className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {heading}
          <span className="ml-2 normal-case opacity-60">({count} trường)</span>
        </h3>
      )}
      {canManage && onRenameGroup ? (
        <button
          type="button"
          aria-label={`Đổi tên nhóm ${name}`}
          onClick={() => setRenaming(true)}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
      ) : null}
      {canManage && onDeleteGroup ? (
        <ConfirmDelete
          title={`Xoá nhóm "${name}"?`}
          description={`Toàn bộ ${count} trường dữ liệu thuộc nhóm này sẽ bị xoá khỏi hồ sơ. Thao tác không thể hoàn tác.`}
          confirmLabel="Xoá nhóm"
          onConfirm={() => void onDeleteGroup(name, count)}
        >
          <button
            type="button"
            aria-label={`Xoá nhóm ${name}`}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </ConfirmDelete>
      ) : null}
    </div>
  );
}

export function FieldRowEditor({
  field,
  active,
  readOnly,
  onFocusField,
  textField,
  derivedValue,
  autoFilled,
  onWords,
  onChanged,
}: {
  field: FieldRow;
  active: boolean;
  readOnly: boolean;
  onFocusField: () => void;
  /** Trường "bằng chữ" đi kèm, sẽ tự điền khi nhập xong số tiền. */
  textField?: FieldRow | null;
  /** Giá trị chữ do ô số tiền sinh ra (chỉ dùng cho ô "bằng chữ"). */
  derivedValue?: string | null;
  /** Ô "bằng chữ" tự sinh: chỉ đọc để không lệch với số. */
  autoFilled?: boolean;
  onWords?: (textFieldId: string, words: string) => void;
  /** Gọi lại sau khi đổi nhãn hoặc xoá trường. */
  onChanged?: (() => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [value, setValue] = useState(field.value ?? "");
  const [label, setLabel] = useState(field.label);
  const [renaming, setRenaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conf = confidenceStyle(Number(field.confidence));
  const isMoney = isMoneyNumberField(field.field_key, field.label) && !!textField;
  const isDate = isDateField(field.field_key, field.label);

  useEffect(() => setValue(field.value ?? ""), [field.value]);

  const shownValue = autoFilled ? (derivedValue ?? value) : value;

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

  /** Cập nhật giá trị và hẹn giờ lưu; ô tiền còn phát ngay phần "bằng chữ". */
  const change = (raw: string) => {
    const next = isMoney ? formatThousands(raw) : raw;
    setValue(next);
    if (isMoney && textField && onWords) onWords(textField.id, readVietnameseMoney(next));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(next), 800);
  };

  const renameField = async () => {
    setRenaming(false);
    const next = label.trim();
    if (!next || next === field.label) {
      setLabel(field.label);
      return;
    }
    const { error } = await supabase
      .from("document_fields")
      .update({ label: next })
      .eq("id", field.id);
    if (error) {
      toast.error("Không đổi được tên trường", { description: error.message });
      setLabel(field.label);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["document_fields", field.document_id] });
    onChanged?.();
  };

  const removeField = async () => {
    const { error } = await supabase.from("document_fields").delete().eq("id", field.id);
    if (error) {
      toast.error("Không xoá được trường", { description: error.message });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["document_fields", field.document_id] });
    onChanged?.();
    toast.success("Đã xoá trường dữ liệu");
  };

  return (
    <div
      onMouseEnter={onFocusField}
      onClick={onFocusField}
      className={`px-4 py-3 transition-colors ${active ? "bg-accent/70" : "hover:bg-accent/40"}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        {renaming ? (
          <input
            value={label}
            autoFocus
            aria-label="Tên trường dữ liệu"
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => void renameField()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void renameField();
              if (e.key === "Escape") {
                setLabel(field.label);
                setRenaming(false);
              }
            }}
            className="w-full max-w-[60%] rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:border-primary"
          />
        ) : (
          <label htmlFor={field.id} className="text-xs font-medium text-muted-foreground">
            {field.label}
            <span className="ml-1.5 text-[10px] opacity-60">{field.field_key}</span>
          </label>
        )}
        <span className="flex items-center gap-1.5">
          {saving ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${conf.cls}`}
          >
            {conf.pct}%{conf.warn ? " · Cần xác minh" : ""}
          </span>
          {!readOnly ? (
            <button
              type="button"
              aria-label={`Sửa tên trường ${field.label}`}
              onClick={() => setRenaming(true)}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
          ) : null}
          {isAdmin ? (
            <ConfirmDelete
              title={`Xoá trường "${field.label}"?`}
              description="Trường dữ liệu này sẽ bị xoá khỏi hồ sơ. Thao tác không thể hoàn tác."
              onConfirm={removeField}
            >
              <button
                type="button"
                aria-label={`Xoá trường ${field.label}`}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </ConfirmDelete>
          ) : null}
        </span>
      </div>

      {isDate ? (
        <DateField
          id={field.id}
          value={value}
          readOnly={readOnly}
          onChange={(next) => {
            setValue(next);
            void save(next);
          }}
        />
      ) : (
        <input
          id={field.id}
          value={shownValue}
          readOnly={readOnly || autoFilled}
          inputMode={isMoney ? "numeric" : undefined}
          placeholder={
            autoFilled
              ? "Tự sinh từ số tiền"
              : conf.warn
                ? "Chưa đọc được — vui lòng nhập tay"
                : "—"
          }
          onChange={(e) => change(e.target.value)}
          onFocus={onFocusField}
          onBlur={() => {
            if (autoFilled) return;
            if (timer.current) clearTimeout(timer.current);
            void save(value);
          }}
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30 read-only:bg-muted"
        />
      )}

      {isMoney && value ? (
        <p className="mt-1 text-[11px] italic text-muted-foreground">
          Bằng chữ: {readVietnameseMoney(value)}
        </p>
      ) : null}
    </div>
  );
}
