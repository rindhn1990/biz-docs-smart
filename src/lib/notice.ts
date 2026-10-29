import { PAYMENT_TEMPLATE_FIELDS } from './payment';
import { formatThousands, readVietnameseMoney } from './money';
import { formatDateVariant } from './format';

export const NOTICE_TEMPLATE_FIELDS = [
  ...PAYMENT_TEMPLATE_FIELDS.filter(f => f.group === 'Nhà thầu' || f.group === 'Gói thầu'),
  { key: 'NT_gia', label: 'Nhà thầu — Giá dự thầu / giá trúng (số)', group: 'Nhà thầu trong gói' },
  { key: 'NT_gia_chu', label: 'Nhà thầu — Giá dự thầu / giá trúng (chữ)', group: 'Nhà thầu trong gói' },
  { key: 'NT_vaitro', label: 'Nhà thầu — Vai trò', group: 'Nhà thầu trong gói' },
  { key: 'GT_gia', label: 'Gói thầu — Giá gói thầu (số)', group: 'Gói thầu' },
  { key: 'GT_gia_chu', label: 'Gói thầu — Giá gói thầu (chữ)', group: 'Gói thầu' },
  { key: 'GT_nguonvon', label: 'Gói thầu — Nguồn vốn', group: 'Gói thầu' },
  { key: 'GT_diadiem', label: 'Gói thầu — Địa điểm', group: 'Gói thầu' },
  { key: 'GT_hinhthuc', label: 'Gói thầu — Hình thức lựa chọn', group: 'Gói thầu' },
  { key: 'TB_so', label: 'Thông báo — Số thông báo', group: 'Thông báo' },
  { key: 'TB_ngay_ky', label: 'Thông báo — Ngày ký', group: 'Thông báo' },
  { key: 'TB_ngay_nhan_hs', label: 'Thông báo — Ngày nhận hồ sơ', group: 'Thông báo' },
  { key: 'TB_noidung', label: 'Thông báo — Nội dung', group: 'Thông báo' },
] as const;

export const NOTICE_CONTRACTOR_KEYS: Record<string, string> = {
  NT_ten:'name', NT_mst:'tax_code', NT_diachi:'address', NT_daidien:'representative',
  NT_chucdanh:'representative_title', NT_dienthoai:'phone', NT_email:'email', NT_taikhoan:'bank_account', NT_nganhang:'bank_name',
};
type Contractor = { name: string; tax_code?: string | null; address?: string | null; representative?: string | null; representative_title?: string | null; phone?: string | null; email?: string | null; bank_account?: string | null; bank_name?: string | null };
type Tender = { name: string; code?: string | null; package_value?: number | null; funding_source?: string | null; location?: string | null; method?: string | null; tender_type?: string | null };
export function noticeValues(contractor: Contractor, tender: Tender, link: { role: string; price: number | null; bid_received_date?: string | null }, common: { number: string; date: string; content: string }, overrides: Record<string,string> = {}, tenderData: Record<string,string> = {}): Record<string,string> {
  const values: Record<string,string> = {};
  for (const [key, column] of Object.entries(NOTICE_CONTRACTOR_KEYS)) values[key] = overrides[column] ?? contractor[column as keyof Contractor] ?? '';
  const money = (n: number | null | undefined) => n == null ? '' : formatThousands(String(n));
  const words = (n: number | null | undefined) => n == null ? '' : readVietnameseMoney(n);
  return { ...values, NT_gia:money(link.price), NT_gia_chu:words(link.price), NT_vaitro:link.role === 'winner' ? 'Trúng thầu' : 'Tham dự',
    GT_ten:tender.name, GT_ma:tender.code ?? '', GT_gia:money(tender.package_value), GT_gia_chu:words(tender.package_value),
    GT_nguonvon:tender.funding_source || tenderData['Nguon_von'] || '', GT_diadiem:tender.location || tenderData['Dia_diem'] || '',
    GT_hinhthuc:tenderData['Hinh_thuc_LCNT'] || tender.method || tender.tender_type || '',
    TB_so:common.number, TB_ngay_ky:common.date, TB_ngay_nhan_hs:formatDateVariant(link.bid_received_date ?? '', 'slash'), TB_noidung:common.content,
  };
}

/** Only allow known contractor columns, and only fill authoritative empty values. */
export function emptyContractorPatch(current: Contractor, incoming: Record<string,string>) {
  const patch: Record<string,string> = {};
  for (const column of Object.values(NOTICE_CONTRACTOR_KEYS)) {
    if (!current[column as keyof Contractor]?.trim() && incoming[column]?.trim()) patch[column] = incoming[column].trim();
  }
  return patch;
}