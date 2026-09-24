import { useEffect, useRef, useState } from "react";
import { Loader2, MousePointerClick, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { docxToHtml, replacePhraseWithToken, type DelimiterStyle } from "@/lib/docx";
import { KHLCNT_FIELDS } from "@/lib/khlcnt";
import { HR_TEMPLATE_FIELDS } from "@/lib/hr";
import { PAYMENT_TEMPLATE_FIELDS } from "@/lib/payment";
import { prettifyPlaceholder } from "@/lib/docx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type Suggestion = {
  placeholder: string;
  label: string;
  source_field: string | null;
  module: string;
};

type Props = {
  templateId: string;
  templateName: string;
  storagePath: string;
  style: DelimiterStyle;
  onClose: () => void;
  onSaved: () => void;
  module: "tender" | "hr" | "payment";
};

/** Xem trước nội dung file Word và bôi đen từng vùng để biến thành chỗ trống dữ liệu. */
export function TemplateRegionPicker({
  templateId,
  templateName,
  storagePath,
  style,
  onClose,
  onSaved,
  module,
}: Props) {
  const sourceFields =
    module === "hr"
      ? HR_TEMPLATE_FIELDS
      : module === "payment"
        ? PAYMENT_TEMPLATE_FIELDS
        : KHLCNT_FIELDS;
  const wrap: [string, string] = style === "square" ? ["[[", "]]"] : ["{{", "}}"];
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [label, setLabel] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [phTouched, setPhTouched] = useState(false);
  const [labelTouched, setLabelTouched] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("template_mappings")
        .select("placeholder,label,source_field,created_at,templates(module)")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (!alive || !data) return;
      const seen = new Map<string, Suggestion>();
      for (const r of data as unknown as {
        placeholder: string;
        label: string;
        source_field: string | null;
        templates: { module: string | null } | null;
      }[]) {
        if (seen.has(r.placeholder)) continue;
        seen.set(r.placeholder, {
          placeholder: r.placeholder,
          label: r.label,
          source_field: r.source_field,
          module: r.templates?.module ?? "tender",
        });
      }
      setSuggestions([...seen.values()]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function chooseSource(next: string) {
    setSource(next);
    if (!next) return;
    const { data } = await supabase
      .from("template_mappings")
      .select("placeholder,label")
      .eq("source_field", next)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return;
    if (!phTouched || !placeholder.trim()) setPlaceholder(data.placeholder);
    if (!labelTouched || !label.trim()) setLabel(data.label);
  }

  function applySuggestion(s: Suggestion) {
    setPlaceholder(s.placeholder);
    setLabel(s.label);
    setSource(s.source_field ?? "");
    setPhTouched(false);
    setLabelTouched(false);
    setSuggestOpen(false);
  }

  const MODULE_NAMES: Record<string, string> = {
    tender: "Đấu thầu",
    hr: "Hợp đồng nhân sự",
    payment: "Thanh toán",
  };
  const suggestionGroups = [module, ...["tender", "hr", "payment"].filter((m) => m !== module)]
    .map((m) => ({ m, items: suggestions.filter((s) => s.module === m) }))
    .filter((g) => g.items.length > 0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data, error: dlError } = await supabase.storage.from("templates").download(storagePath);
      if (!alive) return;
      if (dlError || !data) {
        setError(dlError?.message ?? "Không tải được tệp Word");
        return;
      }
      try {
        setHtml(await docxToHtml(await data.arrayBuffer()));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [storagePath]);

  function captureSelection() {
    const text = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (!text) return;
    setSelection(text);
    if (!label) setLabel(text.length > 60 ? `${text.slice(0, 57)}…` : text);
  }

  async function handleSave() {
    const key = placeholder.trim().replace(/^[[{]+|[\]}]+$/g, "");
    if (!selection) {
      toast.error("Hãy bôi đen đoạn chữ trong bản xem trước trước đã");
      return;
    }
    if (!/^[A-Za-z0-9_]+$/.test(key)) {
      toast.error("Tên vùng dữ liệu chỉ gồm chữ, số và dấu gạch dưới");
      return;
    }
    setSaving(true);
    try {
      const { data, error: dlError } = await supabase.storage
        .from("templates")
        .download(storagePath);
      if (dlError || !data) throw dlError ?? new Error("Không tải được tệp Word");
      const { buffer } = replacePhraseWithToken(
        await data.arrayBuffer(),
        selection,
        `${wrap[0]}${key}${wrap[1]}`,
      );
      const up = await supabase.storage.from("templates").upload(storagePath, buffer, {
        upsert: true,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      if (up.error) throw up.error;

      const { data: existing } = await supabase
        .from("template_mappings")
        .select("id,sort_order")
        .eq("template_id", templateId)
        .eq("placeholder", key)
        .maybeSingle();
      if (!existing) {
        const { data: last } = await supabase
          .from("template_mappings")
          .select("sort_order")
          .eq("template_id", templateId)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { error: insErr } = await supabase.from("template_mappings").insert({
          template_id: templateId,
          placeholder: key,
          label: label.trim() || prettifyPlaceholder(key),
          source_field: source || null,
          sort_order: (last?.sort_order ?? 0) + 1,
        });
        if (insErr) throw insErr;
      }

      setHtml(await docxToHtml(buffer));
      setSelection("");
      setPlaceholder("");
      setLabel("");
      setSource("");
      onSaved();
      toast.success("Đã đánh dấu vùng dữ liệu", {
        description: `Đoạn chữ đã được thay bằng ${wrap[0]}${key}${wrap[1]} trong file Word.`,
      });
    } catch (e) {
      toast.error("Không lưu được vùng dữ liệu", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">Định nghĩa vùng dữ liệu · {templateName}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bôi đen đoạn chữ cần thay đổi trong bản xem trước, đặt tên vùng rồi bấm lưu.
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div
            ref={bodyRef}
            onMouseUp={captureSelection}
            className="prose-docx min-h-0 overflow-y-auto border-b border-border px-6 py-5 text-sm leading-relaxed lg:border-b-0 lg:border-r"
          >
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : html === null ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Đang mở file Word…
              </p>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </div>

          <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Đoạn chữ đang chọn</p>
              <p className="mt-1 rounded-md border border-dashed border-border bg-muted/50 px-3 py-2 text-sm">
                {selection || (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <MousePointerClick className="size-3.5" /> Chưa chọn đoạn nào
                  </span>
                )}
              </p>
            </div>
            <label className="block text-xs font-medium">
              Tên vùng dữ liệu
              <input
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                placeholder="TEN_GOI_THAU"
                className="num mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="block text-xs font-medium">
              Nhãn hiển thị
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="block text-xs font-medium">
              Lấy dữ liệu từ
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              >
                <option value="">Nhập tay</option>
                {sourceFields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label} ({f.key})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={saving || !selection}
              onClick={() => void handleSave()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Lưu vùng dữ liệu
            </button>
            <p className="text-xs text-muted-foreground">
              Đoạn chữ được chọn sẽ được thay bằng {wrap[0]}TEN_VUNG{wrap[1]} ngay trong file Word
              gốc, nên lần xuất sau sẽ điền dữ liệu tự động.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
