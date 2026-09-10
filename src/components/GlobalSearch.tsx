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

type Hit =
  | { kind: "document"; id: string; label: string; sub: string }
  | { kind: "contract"; id: string; label: string; sub: string };

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
      const [docs, contracts] = await Promise.all([
        supabase
          .from("documents")
          .select("id,file_name,ocr_text")
          .or(`file_name.ilike.${like},ocr_text.ilike.${like}`)
          .limit(8),
        supabase
          .from("contracts")
          .select("id,contract_number,title")
          .or(`contract_number.ilike.${like},title.ilike.${like}`)
          .limit(5),
      ]);

      setHits([
        ...(docs.data ?? []).map((d) => ({
          kind: "document" as const,
          id: d.id,
          label: d.file_name,
          sub: "Hồ sơ đấu thầu · tìm cả nội dung đã nhận dạng",
        })),
        ...(contracts.data ?? []).map((c) => ({
          kind: "contract" as const,
          id: c.id,
          label: c.contract_number,
          sub: `Hợp đồng · ${c.title ?? ""}`,
        })),
      ]);
    }, 250);
    return () => clearTimeout(t);
  }, [term]);

  const openHit = (h: Hit) => {
    setOpen(false);
    if (h.kind === "document") {
      void navigate({ to: "/ho-so-dau-thau/$documentId", params: { documentId: h.id } });
    } else {
      void navigate({ to: "/hop-dong" });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/40"
      >
        <Search className="size-4" />
        <span className="truncate">Tìm hồ sơ, hợp đồng, nội dung tài liệu…</span>
        <kbd className="ml-auto hidden rounded border border-border px-1.5 text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Nhập từ khóa…" value={term} onValueChange={setTerm} />
        <CommandList>
          <CommandEmpty>
            {term.length < 2 ? "Nhập ít nhất 2 ký tự." : "Không tìm thấy kết quả nào."}
          </CommandEmpty>
          {hits.length > 0 ? (
            <CommandGroup heading="Kết quả">
              {hits.map((h) => (
                <CommandItem
                  key={`${h.kind}-${h.id}`}
                  value={`${h.label} ${h.sub} ${h.id}`}
                  onSelect={() => openHit(h)}
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
