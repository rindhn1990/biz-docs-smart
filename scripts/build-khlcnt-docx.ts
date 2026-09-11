/**
 * Dựng tạm file .docx mẫu "Tờ trình phê duyệt KHLCNT" (delimiter kiểu [[...]]).
 * Chạy: bun run scripts/build-khlcnt-docx.ts <đường-dẫn-xuất>
 */
import { writeFileSync } from "node:fs";
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

const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE };

function center(text: string, opts: { bold?: boolean; size?: number } = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 24 })],
  });
}

function body(text: string, opts: { italics?: boolean; bold?: boolean } = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120 },
    children: [new TextRun({ text, italics: opts.italics, bold: opts.bold, size: 24 })],
  });
}

function bullet(text: string) {
  return new Paragraph({
    numbering: { reference: "khlcnt-bullets", level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 24 })],
  });
}

function cell(width: number, paragraphs: Paragraph[]) {
  return new TableCell({
    borders: noBorders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: paragraphs,
  });
}

const headerTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [4200, 5160],
  rows: [
    new TableRow({
      children: [
        cell(4200, [
          center("TỔNG CÔNG TY KHÍ VIỆT NAM - CTCP", { bold: true }),
          center("BAN THƯƠNG MẠI VÀ QUẢN LÝ ĐẤU THẦU", { bold: true }),
          center("Số: [[Numb_totrinh_KH]]"),
        ]),
        cell(5160, [
          center("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { bold: true }),
          center("Độc lập - Tự do - Hạnh phúc", { bold: true }),
          center("Thành phố Hồ Chí Minh, ngày   tháng    năm 2025"),
        ]),
      ],
    }),
  ],
});

const signTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [3120, 3120, 3120],
  rows: [
    new TableRow({
      children: [
        cell(3120, [
          new Paragraph({ children: [new TextRun({ text: "Nơi nhận:", bold: true, size: 22 })] }),
          new Paragraph({ children: [new TextRun({ text: "Như trên;", size: 22 })] }),
          new Paragraph({ children: [new TextRun({ text: "Lưu: TMĐT.HN.01", size: 22 })] }),
        ]),
        cell(3120, [
          center("TRƯỞNG BAN BAN TC", { bold: true }),
          new Paragraph({ children: [new TextRun({ text: "", size: 24 })] }),
          new Paragraph({ children: [new TextRun({ text: "", size: 24 })] }),
          new Paragraph({ children: [new TextRun({ text: "", size: 24 })] }),
        ]),
        cell(3120, [
          center("TRƯỞNG BAN BAN TMĐT", { bold: true }),
          new Paragraph({ children: [new TextRun({ text: "", size: 24 })] }),
          new Paragraph({ children: [new TextRun({ text: "", size: 24 })] }),
          new Paragraph({ children: [new TextRun({ text: "", size: 24 })] }),
        ]),
      ],
    }),
  ],
});

const doc = new Document({
  styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
  numbering: {
    config: [
      {
        reference: "khlcnt-bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "-",
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
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        headerTable,
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "TỜ TRÌNH", bold: true, size: 32 })],
        }),
        center('Phê duyệt Kế hoạch lựa chọn nhà thầu cho gói thầu "[[Ten_goi_thau]]"', {
          bold: true,
        }),
        new Paragraph({ children: [new TextRun("")] }),
        body("Kính gửi: Ông Tổng Giám đốc Tổng công ty", { bold: true }),
        body(
          "Căn cứ Quy định về lựa chọn nhà thầu cung cấp nguyên liệu, nhiên liệu, vật liệu, vật tư, dịch vụ tư vấn, dịch vụ phi tư vấn để đảm bảo tính liên tục cho hoạt động sản xuất và mua sắm duy trì hoạt động thường xuyên của Tổng công ty Khí Việt Nam – CTCP, ban hành kèm theo Quyết định số 393/QĐ – KVN ngày 11/4/2024 của Tổng Giám đốc Tổng công ty (sau đây gọi tắt là Quy định về lựa chọn nhà thầu);",
          { italics: true },
        ),
        body(
          'Căn cứ Phê duyệt của Tổng giám đốc Tổng công ty tại Công văn số [[Numb_CVCT]] ngày [[Date_CVCT]] về việc phê duyệt chủ trương "[[Ten_goi_thau]]";',
          { italics: true },
        ),
        body(
          'Căn cứ Phạm vi công việc "[[Ten_goi_thau]]" số [[Numb_SOW]] ngày [[Date_SOW]];',
          { italics: true },
        ),
        body(
          'Căn cứ Quyết định số [[Numb_DToan]] của Tổng giám đốc TCT về việc phê duyệt dự toán gói thầu "[[Ten_goi_thau]]";',
          { italics: true },
        ),
        body(
          "Ban Thương mại và Quản lý đấu thầu (TMĐT), [[Ban_CM]] ([[Kyhieu_BanCM]]) kính trình Ông Tổng Giám đốc TCT xem xét, phê duyệt Kế hoạch lựa chọn nhà thầu (KHLCNT) cho gói thầu nêu trên với các nội dung như sau:",
        ),
        body("Kế hoạch lựa chọn nhà thầu:", { bold: true }),
        bullet('Tên gói thầu: "[[Ten_goi_thau]]".'),
        bullet(
          "Giá gói thầu: [[Gia_goi_thau_numb]] VNĐ (Bằng chữ: [[Gia_goi_thau_text]]), [[Thue_VAT]].",
        ),
        bullet("Nguồn vốn: [[Nguon_von]]."),
        bullet("Hình thức lựa chọn nhà thầu: [[Hinh_thuc_LCNT]]."),
        bullet("Tên nhà thầu được chỉ định thầu: [[NT_trungthau]]."),
        bullet("Thời gian bắt đầu tổ chức lựa chọn nhà thầu: [[Time_start]]."),
        bullet("Loại hợp đồng: [[Loai_HD]]."),
        bullet("Thời gian thực hiện hợp đồng: [[Duration_Contract]]."),
        bullet("Dự thảo hợp đồng: Như đính kèm."),
        new Paragraph({ children: [new TextRun("")] }),
        signTable,
      ],
    },
  ],
});

const out = process.argv[2] ?? "to-trinh-khlcnt.docx";
const buffer = await Packer.toBuffer(doc);
writeFileSync(out, buffer);
console.log("Đã tạo", out, buffer.length, "bytes");
