import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractFieldsLocallyDetailed } from './field-extract.ts';
import { parseVietnameseMoneyWords, readVietnameseMoney } from './money.ts';
import { CONTRACTOR_SCAN_FIELDS } from './contractor.ts';
import { paymentScanExtraFields } from './payment-scan.ts';
const A = `CÔNG TY TNHH TMDV
VẬN TẢI VIETTRANS
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
Tp. Hồ Chí Minh, ngày 14 tháng 09 năm 2026
ĐỀ NGHỊ THANH TOÁN
Kính gửi: TỔNG CÔNG TY KHÍ VIỆT NAM - CTCP
Công ty TNHH TMDV Vận tải Viettrans chân thành cảm ơn sự quan tâm của
Quý Công ty đến các dịch vụ vận tải do Viettrans cung cấp.
Căn cứ Hợp đồng số số 31/2026/PVGAS/TMPC-VIETTRANS/D4, ký ngày
30/01/2026 Tổng Công ty Khí Việt Nam CTCP và Công ty TNHH TMDV Vận tải
Viettrans.
Viettrans xin thông báo số tiền thuê xe tháng 08/2026 Quý Công ty cần thanh
toán cho các xe theo bảng kê và hoá đơn số 00000501 ngày 07/09/2026 đính kèm, cụ
thể:
Tổng số tiền thanh toán: 1.698.664.015 đồng.
Bằng chữ: Một tỷ, sáu trăm chín mươi tám triệu, sáu trăm sáu mươi bốn ngàn,
mười lăm đồng chẵn.
Bằng công văn này Viettrans đề nghị Quý Công ty thanh toán theo tài khoản sau:
Tên tài khoản : Công ty TNHH TMDV Vận Tải VIETTRANS
Số tài khoản : 0705000003979
Ngân hàng : Ngân hàng Public Bank Chi nhánh Chợ Lớn
Rất mong nhận được sự ủng hộ tiếp tục từ Quý Công ty.
Trân trọng cảm ơn!
Nơi nhận:
- Như trên;
- Lưu: VT.
GIÁM ĐỐC
Nguyễn Quang Bình`;
const B = `CONG TY TNHH TMDV CONG HOA XA HOI CHU NGHIA VIET NAM
VAN TAI VIETTRANS Déc lip - Tw do - Hanh phic

Tp. Ho Chi Minh, ngay 14 thang 09 ném 2026

DE NGHI THANH TOAN

Kinh giri: TONG CONG TY KHi VIET NAM - CTCP

Cong ty TNHH TMDV Van tai Viettrans chan thanh cam on su quan tam cua
Quy Céng ty dén cdc dich vu van tai do Viettrans cung cap.

Can cir Hop déng sé sé 31/2026/PVGAS/TMPC-VIETTRANS/D4, ky ngay
30/01/2026 Téng Céng ty Khi Viét Nam CTCP va Cong ty TNHH TMDV Van tai
Viettrans.

Viettrans xin thong bao sé tién thué xe thang 08/2026 Quy Cong ty can thanh
toan cho cac xe theo bang ké va hoa don sé 00000501 ngay 07/09/2026 dinh kém, cu
thé:

Téng s6 tién thanh todn: 1.698.664.015 dong.

Bang chir: Mot ty, sau tram chin muoi tam trigu, sau tram sau muoi bén ngan,
mudi lam d6ng chin.

Bang céng van nay Viettrans dé nghi Quy Céng ty thanh ton theo tai khoan sau:

Tén tai khoan : Cong ty TNHH TMDV Van Tai VIETTRANS

Sé tai khoan : 0705000003979

Ngan hang : Ngan hang Public Bank Chi nhanh Cho Léon

Rat mong nhan duge sy tng hd tiép tuc tir Quy Cong ty.

Tran trong cam on!

Noi nh@n:
- Nhw trén;
- Luu: VT.`;
const fields = [...CONTRACTOR_SCAN_FIELDS.map(f=>({key:f.key,label:f.label})), {key:'pay_amount',label:'Số tiền thanh toán'}, {key:'pay_amount_text',label:'Số tiền bằng chữ'}, ...paymentScanExtraFields([])];
const fold = s => s.replace(/[đĐ]/g,'d').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const run = t => { const r = extractFieldsLocallyDetailed(t, fields); return { v: Object.fromEntries(r.values.map(x=>[x.key,x])), w: r.warnings }; };
describe('Văn bản A', () => {
  const { v } = run(A);
  it('tài khoản/ngân hàng', () => { assert.equal(v.bank_account.value,'0705000003979'); assert.ok(v.bank_name.value.startsWith('Ngân hàng Public Bank')); });
  it('tiền + chữ khớp', () => { assert.equal(v.pay_amount.value,'1.698.664.015'); assert.ok(v.pay_amount_text.value.includes('mười lăm đồng chẵn')); assert.ok(v.pay_amount_text.confidence>=0.95); });
  it('hợp đồng/ngày', () => { assert.equal(v.HD_so.value,'31/2026/PVGAS/TMPC-VIETTRANS/D4'); assert.equal(v.HD_ngay.value,'30/01/2026'); assert.equal(v.TT_ngay.value,'14/09/2026'); });
  it('nội dung', () => { assert.ok(v.TT_noidung.value.startsWith('số tiền thuê xe tháng 08/2026')); assert.ok(!v.TT_noidung.value.includes('Kính gửi')); });
  it('đơn vị/đại diện', () => { assert.equal(v.name.value,'Công ty TNHH TMDV Vận Tải VIETTRANS'); assert.equal(v.representative.value,'Nguyễn Quang Bình'); assert.equal(v.representative_title.value,'GIÁM ĐỐC'); });
  it('để trống MST/điện thoại/email/địa chỉ', () => { for (const k of ['tax_code','phone','email','address']) assert.equal(v[k], undefined, k); });
});
describe('Văn bản B (OCR mất dấu)', () => {
  const { v } = run(B);
  it('tài khoản, tiền', () => { assert.equal(v.bank_account.value,'0705000003979'); assert.equal(v.pay_amount.value,'1.698.664.015'); assert.ok(v.pay_amount.confidence>=0.7); });
  it('hợp đồng/ngày', () => { assert.equal(v.HD_so.value,'31/2026/PVGAS/TMPC-VIETTRANS/D4'); assert.equal(v.HD_ngay.value,'30/01/2026'); assert.equal(v.TT_ngay.value,'14/09/2026'); });
  it('chữ hai dòng', () => assert.ok(v.pay_amount_text.value.includes('d6ng chin')));
  it('nội dung', () => { assert.ok(fold(v.TT_noidung.value).startsWith('se tien thue xe thang 08/2026')); assert.ok(!v.TT_noidung.value.includes('Kinh giri')); });
  it('tên đơn vị', () => { assert.ok(fold(v.name.value).includes('cong ty tnhh tmdv van tai viettrans')); assert.ok(!fold(v.name.value).includes('cong hoa xa hoi')); });
  it('không đoán MST', () => { for (const k of ['tax_code','phone','email']) assert.equal(v[k], undefined, k); });
});
describe('Đọc ngược chữ thành số', () => {
  for (const n of [1698664015, 305532000, 12000000, 1000015, 500]) it(String(n), () => assert.equal(parseVietnameseMoneyWords(readVietnameseMoney(n)), n));
  it('ngàn/nghìn, không dấu', () => { assert.equal(parseVietnameseMoneyWords('mot ty, sau tram chin muoi tam trieu, sau tram sau muoi bon ngan, muoi lam dong chan'),1698664015); assert.equal(parseVietnameseMoneyWords('Năm trăm nghìn đồng'),500000); });
  it('OCR hỏng → null', () => assert.equal(parseVietnameseMoneyWords('Mot ty, sau tram trigu'), null));
  it('số và chữ lệch → cảnh báo', () => { const r = run('Tổng số tiền thanh toán: 1.000.000 đồng.\nBằng chữ: Hai triệu đồng.'); assert.deepEqual(r.w,['Số tiền bằng số và bằng chữ không khớp']); assert.ok(r.v.pay_amount.confidence<=0.3); });
  it('chỉ có số → tự tính chữ', () => { const r = run('Tổng số tiền thanh toán: 305.532.000 đồng.'); assert.equal(r.v.pay_amount_text.value, readVietnameseMoney(305532000)); assert.equal(r.v.pay_amount_text.confidence,0.9); });
});
