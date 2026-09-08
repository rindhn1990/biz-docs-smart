import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type Hit = { id: string; label: string; sub: string; to: string };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const like = `%${q}%`;
      const [tenders, contracts, customers, docs, projects] = await Promise.all([
        supabase.from("tenders").select("id,code,name").or(`name.ilike.${like},code.ilike.${like}`).limit(5),
        supabase
          .from("contracts")
          .select("id,contract_number,title")
          .or(`contract_number.ilike.${like},title.ilike.${like}`)
          .limit(5),
        supabase
          .from("customers")
          .select("id,name,tax_code")
          .or(`name.ilike.${like},tax_code.ilike.${like}`)
          .limit(5),
        supabase
          .from("documents")
          .select("id,file_name,ocr_text")
          .or(`file_name.ilike.${like},ocr_text.ilike.${like}`)
          .limit(6),
        supabase.from("projects").select("id,name,code").or(`name.ilike.${like},code.ilike.${like}`).limit(5),
      ]);

      const result: Hit[] = [
        ...(tenders.data ?? []).map((t) => ({
          id: `t-${t.id}`,
          label: t.name,
          sub: `Gói thầu · ${t.code ?? "—"}`,
          to: `/goi-thau/${t.id}`,
        })),
        ...(contracts.data ?? []).map((c) => ({
          id: `c-${c.id}`,
          label: c.contract_number,
          sub: `Hợp đồng · ${c.title ?? ""}`,
          to: `/hop-dong/${c.id}`,
        })),
        ...(projects.data ?? []).map((p) => ({
          id: `p-${p.id}`,
          label: p.name,
          sub: `Dự án · ${p.code ?? "—"}`,
          to: `/tai-lieu`,
        })),
        ...(customers.data ?? []).map((c) => ({
          id: `k-${c.id}`,
          label: c.name,
          sub: `Khách hàng · MST ${c.tax_code ?? "—"}`,
          to: `/cai-dat`,
        })),
        ...(docs.data ?? []).map((d) => ({
          id: `d-${d.id}`,
          label: d.file_name,
          sub: "Tài liệu · tìm cả nội dung đã nhận dạng",
          to: `/ho-so/${d.id}`,
        })),
      ];
      setHits(result);
    }, 250);
    return () => clearTimeout(t);
  }, [term]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/40"
      >
        <Search className="size-4" />
        <span className="truncate">Tìm dự án, hợp đồng, gói thầu, nội dung tài liệu…</span>
        <kbd className="ml-auto hidden rounded border border-border px-1.5 text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Nhập từ khóa…"
          value={term}
          onValueChange={setTerm}
        />
        <CommandList>
          <CommandEmpty>
            {term.length < 2 ? "Nhập ít nhất 2 ký tự." : "Không tìm thấy kết quả nào."}
          </CommandEmpty>
          {hits.length > 0 ? (
            <CommandGroup heading="Kết quả">
              {hits.map((h) => (
                <CommandItem
                  key={h.id}
                  value={`${h.label} ${h.sub} ${h.id}`}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({ to: h.to });
                  }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{h.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{h.sub}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
