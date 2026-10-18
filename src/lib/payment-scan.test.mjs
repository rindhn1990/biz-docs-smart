import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { extractFieldsLocally } from './field-extract.ts';
import { paymentScanExtraFields, splitPaymentScan } from './payment-scan.ts';
import { renderDocxBuffer } from './docx.ts';

const text = 'Tp. Hồ Chí Minh, ngày 14 tháng 09 năm 2026\nCăn cứ Hợp đồng số số 31/2026/PVGAS/TMPC-VIETTRANS/D4, ký ngày 30/01/2026\nTổng số tiền thanh toán: 305.532.000 đồng.';
const fields = [...paymentScanExtraFields([]), { key: 'pay_amount', label: 'Số tiền thanh toán' }];
const scanned = Object.fromEntries(extractFieldsLocally(text, fields).map(f => [f.key, f.value]));
describe('Payment scan rules', () => {
  it('keeps the four core sources without configured templates', () => {
    assert.deepEqual(new Set(paymentScanExtraFields([]).map(f => f.key)), new Set(['HD_so', 'HD_ngay', 'TT_noidung', 'TT_ngay']));
  });
  it('adds only supported sources and does not duplicate contractor or amount fields', () => {
    assert.deepEqual(paymentScanExtraFields(['GT_ma','HD_giatri','NT_ten','TT_sotien','unknown']).map(f => f.key), ['GT_ma','HD_so','HD_ngay','HD_giatri','TT_noidung','TT_ngay']);
  });
  it('reads the repeated số contract identifier', () => assert.equal(scanned.HD_so, '31/2026/PVGAS/TMPC-VIETTRANS/D4'));
  it('uses the signing date rather than the document header date', () => assert.equal(scanned.HD_ngay, '30/01/2026'));
  it('uses the document header for the request date', () => assert.equal(scanned.TT_ngay, '14/09/2026'));
  it('reads the payment amount', () => assert.equal(scanned.pay_amount, '305.532.000'));
  it('does not mistake header date fragments for bank data or numeric money for words', () => {
    assert.deepEqual(extractFieldsLocally(text, [
      {key:'bank_account',label:'Số tài khoản ngân hàng'},
      {key:'bank_name',label:'Tên ngân hàng và chi nhánh'},
      {key:'pay_amount_text',label:'Số tiền bằng chữ'},
      {key:'HD_giatri',label:'Tổng giá trị'},
    ]), []);
  });
  it('normalizes word dates and separates contractor, content and edits', () => {
    assert.deepEqual(splitPaymentScan({ name:'Công ty A', HD_ngay:'ngày 3 tháng 1 năm 2026', HD_so:' ', TT_noidung:'Thanh toán đợt 2', pay_amount:'305.532.000' }), {
      contractor:{name:'Công ty A'}, edits:{HD_ngay:'03/01/2026'}, amount:'305.532.000', content:'Thanh toán đợt 2'
    });
  });
  it('does not substitute a generic document number or date for a missing contract', () => {
    const result = extractFieldsLocally('Số: 13/KT\nTp. Hồ Chí Minh, ngày 14 tháng 09 năm 2026', fields);
    assert.equal(result.some(f => f.key === 'HD_so' || f.key === 'HD_ngay'), false);
  });
  it('reads installment, quoted tender and payment description', () => {
    const result = Object.fromEntries(extractFieldsLocally('Gói thầu “Dịch vụ vận chuyển”\nĐề nghị thanh toán: Chi phí vận chuyển đợt 2', paymentScanExtraFields(['GT_ten','TT_dot'])).map(f => [f.key, f.value]));
    assert.equal(result.GT_ten, 'Dịch vụ vận chuyển');
    assert.equal(result.TT_dot, '2');
    assert.equal(result.TT_noidung, 'Chi phí vận chuyển đợt 2');
  });
});

function sample(style) {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${style === 'curly' ? '{{Num_HD}} / {{Date_HD}}' : '[[Num_HD]] / [[Date_HD]]'}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generate({type:'arraybuffer'});
}
for (const style of ['curly','square']) {
  it(`fills contract number/date and preserves empty ${style} placeholders and formatting`, () => {
    const source = sample(style);
    const data = {Num_HD: scanned.HD_so, Date_HD: scanned.HD_ngay};
    const filled = new PizZip(renderDocxBuffer(source, style, data)).file('word/document.xml').asText();
    assert.ok(filled.includes('31/2026/PVGAS/TMPC-VIETTRANS/D4 / 30/01/2026'));
    assert.ok(filled.includes('<w:b/>'));
    const empty = new PizZip(renderDocxBuffer(source, style, {Num_HD:' ',Date_HD:''})).file('word/document.xml').asText();
    assert.ok(empty.includes(style === 'curly' ? '{{Num_HD}} / {{Date_HD}}' : '[[Num_HD]] / [[Date_HD]]'));
    assert.ok(empty.includes('<w:b/>'));
  });
}