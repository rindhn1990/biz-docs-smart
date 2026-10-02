import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

type Fmt = { bold?: boolean; italics?: boolean; underline?: boolean };
type Block = Paragraph | Table;

const CONTENT_WIDTH = 9026; // A4, lề 1 inch (DXA)

function runs(node: Node, fmt: Fmt = {}): TextRun[] {
  const out: TextRun[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? "").replace(/\s+/g, " ");
      if (text) {
        out.push(
          new TextRun({
            text,
            bold: fmt.bold,
            italics: fmt.italics,
            underline: fmt.underline ? {} : undefined,
          }),
        );
      }
      return;
    }
    if (!(child instanceof HTMLElement)) return;
    const tag = child.tagName.toLowerCase();
    if (tag === "br") {
      out.push(new TextRun({ text: "", break: 1 }));
      return;
    }
    const next: Fmt = { ...fmt };
    if (tag === "b" || tag === "strong") next.bold = true;
    if (tag === "i" || tag === "em") next.italics = true;
    if (tag === "u") next.underline = true;
    out.push(...runs(child, next));
  });
  return out;
}

function alignOf(el: HTMLElement) {
  const a = el.style.textAlign || el.getAttribute("align") || "";
  if (a === "center") return AlignmentType.CENTER;
  if (a === "right") return AlignmentType.RIGHT;
  if (a === "justify") return AlignmentType.JUSTIFIED;
  return undefined;
}

function blocks(container: Node): Block[] {
  const out: Block[] = [];
  let inline: Node[] = [];
  const flush = () => {
    if (inline.length === 0) return;
    const wrap = document.createElement("span");
    inline.forEach((n) => wrap.appendChild(n.cloneNode(true)));
    const r = runs(wrap);
    if (r.length > 0 && (wrap.textContent ?? "").trim()) out.push(new Paragraph({ children: r }));
    inline = [];
  };

  container.childNodes.forEach((child) => {
    if (!(child instanceof HTMLElement)) {
      inline.push(child);
      return;
    }
    const tag = child.tagName.toLowerCase();
    if (["b", "strong", "i", "em", "u", "span", "a", "br", "sup", "sub"].includes(tag)) {
      inline.push(child);
      return;
    }
    flush();
    if (/^h[1-6]$/.test(tag)) {
      const level = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6,
      ][Number(tag[1]) - 1];
      out.push(new Paragraph({ heading: level, alignment: alignOf(child), children: runs(child) }));
    } else if (tag === "p") {
      out.push(new Paragraph({ alignment: alignOf(child), children: runs(child) }));
    } else if (tag === "ul" || tag === "ol") {
      child.querySelectorAll(":scope > li").forEach((li) => {
        out.push(
          new Paragraph({
            numbering: { reference: tag === "ul" ? "bullets" : "numbers", level: 0 },
            children: runs(li),
          }),
        );
      });
    } else if (tag === "table") {
      const trs = Array.from(child.querySelectorAll("tr"));
      const cols = Math.max(1, ...trs.map((tr) => tr.querySelectorAll(":scope > td, :scope > th").length));
      const w = Math.floor(CONTENT_WIDTH / cols);
      const border = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
      const borders = { top: border, bottom: border, left: border, right: border };
      out.push(
        new Table({
          width: { size: w * cols, type: WidthType.DXA },
          columnWidths: Array(cols).fill(w),
          rows: trs.map(
            (tr) =>
              new TableRow({
                children: Array.from(tr.querySelectorAll(":scope > td, :scope > th")).map((td) => {
                  const span = Number((td as HTMLTableCellElement).colSpan) || 1;
                  const inner = blocks(td);
                  return new TableCell({
                    borders,
                    columnSpan: span > 1 ? span : undefined,
                    width: { size: w * span, type: WidthType.DXA },
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: inner.length > 0 ? inner : [new Paragraph("")],
                  });
                }),
              }),
          ),
        }),
      );
    } else {
      out.push(...blocks(child));
    }
  });
  flush();
  return out;
}

/** Chuyển HTML từ trình soạn thảo thành file .docx (đoạn, tiêu đề, đậm/nghiêng/gạch chân, danh sách, bảng). */
export async function htmlToDocxBlob(html: string): Promise<Blob> {
  const root = document.createElement("div");
  root.innerHTML = html;
  const children = blocks(root);
  const doc = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 26 } } } },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        {
          reference: "numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: children.length > 0 ? children : [new Paragraph("")],
      },
    ],
  });
  return Packer.toBlob(doc);
}
