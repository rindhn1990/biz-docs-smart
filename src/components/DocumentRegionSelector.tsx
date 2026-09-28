import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Focus,
  Hand,
  Loader2,
  Minus,
  MousePointer2,
  Plus,
  ScanLine,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type PageImage = {
  blob: Blob;
  url: string;
  width: number;
  height: number;
};

type Region = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Point = { x: number; y: number };

const MIN_REGION = 0.012;
const MAX_COMPOSITE_HEIGHT = 14_000;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

async function blobToPage(blob: Blob): Promise<PageImage> {
  const bitmap = await createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  const page = { blob, url, width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return page;
}

async function loadPages(file: File, onProgress: (message: string) => void): Promise<PageImage[]> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return [await blobToPage(file)];

  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: PageImage[] = [];
  const total = Math.min(pdfDocument.numPages, 15);
  for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
    onProgress(`Đang mở trang ${pageNumber}/${total}…`);
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport } as Parameters<typeof page.render>[0]).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value: Blob | null) => (value ? resolve(value) : reject(new Error("Không tạo được ảnh trang PDF."))), "image/jpeg", 0.92),
    );
    pages.push(await blobToPage(blob));
  }
  return pages;
}

async function cropRegions(pages: PageImage[], regions: Region[], fileName: string) {
  const ordered = [...regions].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  const crops = await Promise.all(
    ordered.map(async (region) => {
      const page = pages[region.page];
      if (!page) throw new Error("Không tìm thấy trang chứa vùng đã chọn.");
      const bitmap = await createImageBitmap(page.blob);
      const sx = Math.round(region.x * page.width);
      const sy = Math.round(region.y * page.height);
      const sw = Math.max(1, Math.round(region.width * page.width));
      const sh = Math.max(1, Math.round(region.height * page.height));
      return { bitmap, sx, sy, sw, sh };
    }),
  );

  const targetWidth = Math.min(1800, Math.max(...crops.map((crop) => crop.sw)));
  const gap = 24;
  const rawHeight = crops.reduce((sum, crop) => sum + Math.round((crop.sh / crop.sw) * targetWidth), 0) + gap * (crops.length - 1);
  const scale = Math.min(1, MAX_COMPOSITE_HEIGHT / Math.max(1, rawHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(targetWidth * scale));
  canvas.height = Math.max(1, Math.round(rawHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không hỗ trợ cắt vùng ảnh.");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  let y = 0;
  for (const crop of crops) {
    const height = Math.round((crop.sh / crop.sw) * canvas.width);
    context.drawImage(crop.bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, y, canvas.width, height);
    y += height + Math.round(gap * scale);
    crop.bitmap.close();
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Không tạo được tệp vùng đã chọn."))), "image/jpeg", 0.94),
  );
  const stem = fileName.replace(/\.[^.]+$/, "") || "tai-lieu";
  return new File([blob], `${stem}-vung-da-chon.jpg`, { type: "image/jpeg" });
}

export function DocumentRegionSelector({
  file,
  disabled,
  onScan,
}: {
  file: File;
  disabled?: boolean;
  onScan: (file: File, regionCount: number) => Promise<void> | void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const wheelHandlerRef = useRef<(event: WheelEvent) => void>(() => undefined);
  const dragRef = useRef<
    | { kind: "draw"; start: Point; current: Point }
    | { kind: "pan"; start: Point; offset: Point }
    | null
  >(null);
  const [pages, setPages] = useState<PageImage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [regions, setRegions] = useState<Region[]>([]);
  const [draft, setDraft] = useState<{ start: Point; current: Point } | null>(null);
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 24, y: 24 });
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    let alive = true;
    let loaded: PageImage[] = [];
    setLoading(true);
    setError("");
    setRegions([]);
    setPageIndex(0);
    void loadPages(file, setProgress)
      .then((result) => {
        loaded = result;
        if (alive) setPages(result);
      })
      .catch((reason) => {
        if (alive) setError((reason as Error).message);
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
          setProgress("");
        }
      });
    return () => {
      alive = false;
      loaded.forEach((page) => URL.revokeObjectURL(page.url));
    };
  }, [file]);

  function resetView() {
    const viewport = viewportRef.current;
    const page = pages[pageIndex];
    if (!viewport || !page) return;
    const baseWidth = Math.min(760, page.width);
    const baseHeight = (page.height / page.width) * baseWidth;
    const next = clamp(Math.min((viewport.clientWidth - 32) / baseWidth, (viewport.clientHeight - 32) / baseHeight), 0.2, 1.5);
    setZoom(next);
    setOffset({
      x: Math.max(16, (viewport.clientWidth - baseWidth * next) / 2),
      y: Math.max(16, (viewport.clientHeight - baseHeight * next) / 2),
    });
  }

  useEffect(() => {
    if (!pages[pageIndex]) return;
    const frame = requestAnimationFrame(resetView);
    return () => cancelAnimationFrame(frame);
  }, [pageIndex, pages]);

  function zoomAt(nextZoom: number, anchor?: Point) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const next = clamp(nextZoom, 0.25, 4);
    const point = anchor ?? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    const ratio = next / zoom;
    setOffset((current) => ({
      x: point.x - (point.x - current.x) * ratio,
      y: point.y - (point.y - current.y) * ratio,
    }));
    setZoom(next);
  }

  wheelHandlerRef.current = (event) => {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
    zoomAt(zoom * Math.exp(-delta * 0.0015), { x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const listener = (event: WheelEvent) => wheelHandlerRef.current(event);
    viewport.addEventListener("wheel", listener, { passive: false });
    return () => viewport.removeEventListener("wheel", listener);
  }, []);

  function normalizedPoint(clientX: number, clientY: number): Point | null {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return { x: clamp((clientX - rect.left) / rect.width), y: clamp((clientY - rect.top) / rect.height) };
  }

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || loading) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "pan" || event.button === 1 || event.shiftKey) {
      dragRef.current = { kind: "pan", start: { x: event.clientX, y: event.clientY }, offset };
      return;
    }
    const point = normalizedPoint(event.clientX, event.clientY);
    if (!point) return;
    dragRef.current = { kind: "draw", start: point, current: point };
    setDraft({ start: point, current: point });
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan") {
      setOffset({ x: drag.offset.x + event.clientX - drag.start.x, y: drag.offset.y + event.clientY - drag.start.y });
      return;
    }
    const point = normalizedPoint(event.clientX, event.clientY);
    if (!point) return;
    drag.current = point;
    setDraft({ start: drag.start, current: point });
  }

  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag?.kind !== "draw") return;
    const x = Math.min(drag.start.x, drag.current.x);
    const y = Math.min(drag.start.y, drag.current.y);
    const width = Math.abs(drag.current.x - drag.start.x);
    const height = Math.abs(drag.current.y - drag.start.y);
    setDraft(null);
    if (width < MIN_REGION || height < MIN_REGION) return;
    setRegions((current) => [...current, { id: crypto.randomUUID(), page: pageIndex, x, y, width, height }]);
  }

  async function scanRegions() {
    if (!regions.length) return;
    setPreparing(true);
    try {
      await onScan(await cropRegions(pages, regions, file.name), regions.length);
    } catch (reason) {
      toast.error("Không chuẩn bị được vùng đã chọn", { description: (reason as Error).message });
    } finally {
      setPreparing(false);
    }
  }

  const page = pages[pageIndex];
  const pageRegions = regions.filter((region) => region.page === pageIndex);
  const displayWidth = page ? Math.min(760, page.width) : 760;
  const displayHeight = page ? (page.height / page.width) * displayWidth : 900;
  const draftRect = draft
    ? {
        x: Math.min(draft.start.x, draft.current.x),
        y: Math.min(draft.start.y, draft.current.y),
        width: Math.abs(draft.current.x - draft.start.x),
        height: Math.abs(draft.current.y - draft.start.y),
      }
    : null;

  return (
    <section className="mb-4 overflow-hidden rounded-md border border-border bg-muted/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-3 py-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant={tool === "select" ? "secondary" : "ghost"} onClick={() => setTool("select")}>
            <MousePointer2 /> Khoanh vùng
          </Button>
          <Button size="sm" variant={tool === "pan" ? "secondary" : "ghost"} onClick={() => setTool("pan")}>
            <Hand /> Kéo tài liệu
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Thu nhỏ" onClick={() => zoomAt(zoom / 1.2)}><Minus /></Button>
          <span className="w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="ghost" aria-label="Phóng to" onClick={() => zoomAt(zoom * 1.2)}><Plus /></Button>
          <Button size="icon" variant="ghost" aria-label="Vừa khung" onClick={resetView}><Focus /></Button>
          {regions.length ? (
            <Button size="sm" variant="ghost" onClick={() => setRegions([])}><Trash2 /> Xoá tất cả</Button>
          ) : null}
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`relative h-[52vh] min-h-[360px] max-h-[620px] overflow-hidden bg-muted/50 touch-none ${tool === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="animate-spin" /> {progress || "Đang mở tài liệu…"}
          </div>
        ) : error ? (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-destructive">{error}</p>
        ) : page ? (
          <div
            className="absolute origin-top-left shadow-lg"
            style={{ width: displayWidth, height: displayHeight, transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
          >
            <img ref={imageRef} src={page.url} alt={`Trang ${pageIndex + 1}`} draggable={false} className="block size-full select-none bg-background object-fill" />
            {pageRegions.map((region) => {
              const number = regions.findIndex((item) => item.id === region.id) + 1;
              return (
                <div
                  key={region.id}
                  className="absolute border-2 border-primary bg-primary/15"
                  style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }}
                >
                  <span className="absolute left-0 top-0 flex size-6 -translate-y-full items-center justify-center rounded-t-sm bg-primary text-xs font-semibold text-primary-foreground">{number}</span>
                  <Button
                    size="icon"
                    variant="destructive"
                    aria-label={`Xoá vùng ${number}`}
                    className="absolute right-0 top-0 size-6 -translate-y-full"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setRegions((current) => current.filter((item) => item.id !== region.id))}
                  ><Trash2 /></Button>
                </div>
              );
            })}
            {draftRect ? (
              <div className="pointer-events-none absolute border-2 border-dashed border-primary bg-primary/10" style={{ left: `${draftRect.x * 100}%`, top: `${draftRect.y * 100}%`, width: `${draftRect.width * 100}%`, height: `${draftRect.height * 100}%` }} />
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background px-3 py-2">
        <div className="flex items-center gap-2">
          {pages.length > 1 ? (
            <>
              <Button size="icon" variant="outline" aria-label="Trang trước" disabled={pageIndex === 0} onClick={() => setPageIndex((current) => current - 1)}><ChevronLeft /></Button>
              <span className="text-xs text-muted-foreground">Trang {pageIndex + 1}/{pages.length} · {pageRegions.length} vùng</span>
              <Button size="icon" variant="outline" aria-label="Trang sau" disabled={pageIndex === pages.length - 1} onClick={() => setPageIndex((current) => current + 1)}><ChevronRight /></Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Kéo chuột để khoanh nhiều vùng cần lấy dữ liệu.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={disabled || loading || preparing} onClick={() => void onScan(file, 0)}>Quét toàn bộ</Button>
          <Button disabled={disabled || loading || preparing || regions.length === 0} onClick={() => void scanRegions()}>
            {preparing ? <Loader2 className="animate-spin" /> : <ScanLine />}
            Quét {regions.length} vùng đã chọn
          </Button>
        </div>
      </div>
    </section>
  );
}