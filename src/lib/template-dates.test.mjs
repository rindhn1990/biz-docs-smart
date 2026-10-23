import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { formatDateVariant, detectDateVariant, isDateSource } from './format.ts';
import { fillMappings, applyMappingDateFormats } from './template-values.ts';
import { renderDocxBuffer } from './docx.ts';

describe('Word region date rules', () => {
  for (const [variant, expected] of [
    ['slash','31/01/2026'], ['vn_full','ngày 31 tháng 01 năm 2026'],
    ['vn_full_short','ngày 31 tháng 1 năm 2026'], ['vn_no_prefix','31 tháng 01 năm 2026'],
  ]) it(variant, () => assert.equal(formatDateVariant('31/01/2026', variant), expected));
  it('pads single-digit source dates', () => assert.equal(formatDateVariant('3/1/2026', 'vn_full'), 'ngày 03 tháng 01 năm 2026'));
  it('unpads day and month', () => assert.equal(formatDateVariant('03/01/2026', 'vn_full_short'), 'ngày 3 tháng 1 năm 2026'));
  it('accepts ISO dates without timezone conversion', () => assert.equal(formatDateVariant('2026-01-31', 'vn_full'), 'ngày 31 tháng 01 năm 2026'));
  it('leaves null formats unchanged', () => assert.equal(formatDateVariant('2026-01-31', null), '2026-01-31'));
  it('leaves empty values untouched', () => assert.equal(formatDateVariant('', 'vn_full'), ''));
  it('rejects invalid calendar dates verbatim', () => {
    for (const v of ['31/02/2026','29/02/2026','2026-13-01','00/01/2026','1/1/0000','không rõ']) assert.equal(formatDateVariant(v, 'vn_full'), v);
    assert.equal(formatDateVariant('29/02/2024', 'vn_full'), 'ngày 29 tháng 02 năm 2024');
  });
  for (const [text, expected] of [
    ['ngày 31 tháng 01 năm 2026','vn_full'], ['ngày 19 tháng 8 năm 2026','vn_full_short'],
    ['31 tháng 01 năm 2026','vn_no_prefix'], ['31/01/2026','slash'],
    ['Ngày ký hợp đồng',null], ['ngày 31 tháng 02 năm 2026',null], ['ký ngày 31 tháng 01 năm 2026',null],
  ]) it(`detects only complete dates: ${text}`, () => assert.equal(detectDateVariant(text), expected));
  it('recognizes source keys in all three modules', () => {
    for (const key of ['Date_DToan','HD_ngay','TT_ngay','TT_hanthanhtoan','employees.date_of_birth','employee_contracts.start_date','id_issue_date']) assert.equal(isDateSource(key), true);
    assert.equal(isDateSource('TT_sotien'), false);
  });
});

const mappings = [
  {placeholder:'Date_HD', source_field:'HD_ngay',value:'example',date_format:'vn_full'},
  {placeholder:'Date_Thanhtoan',source_field:null,value:'example',date_format:'vn_full_short'},
];
const inherited = new Map([['datethanhtoan','TT_ngay']]);
it('formats explicit and inherited sources with their own region setting', () => {
  assert.deepEqual(fillMappings(mappings, {HD_ngay:'31/01/2026',TT_ngay:'19/08/2026'}, inherited), {
    Date_HD:'ngày 31 tháng 01 năm 2026',Date_Thanhtoan:'ngày 19 tháng 8 năm 2026',
  });
});
it('never fills example values or constructs empty wording', () => assert.deepEqual(fillMappings(mappings, {}, inherited), {Date_HD:'',Date_Thanhtoan:''}));
it('preserves invalid mapped values', () => assert.equal(fillMappings(mappings, {HD_ngay:'31/02/2026'}, inherited).Date_HD, '31/02/2026'));
it('formats re-export snapshots without re-resolving other source data', () => {
  assert.deepEqual(applyMappingDateFormats(mappings, {Date_HD:'31/01/2026',other:'retained'}), {Date_HD:'ngày 31 tháng 01 năm 2026',other:'retained'});
});
it('exports both populated and empty date regions without changing Word formatting', () => {
  const zip = new PizZip();
  zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{{Date_HD}} / {{Date_Thanhtoan}}</w:t></w:r></w:p></w:body></w:document>');
  const source = zip.generate({type:'arraybuffer'});
  const filled = new PizZip(renderDocxBuffer(source,'curly',fillMappings(mappings,{HD_ngay:'31/01/2026',TT_ngay:'19/08/2026'},inherited))).file('word/document.xml').asText();
  assert.ok(filled.includes('ngày 31 tháng 01 năm 2026 / ngày 19 tháng 8 năm 2026'));
  assert.ok(filled.includes('<w:b/>'));
  const empty = new PizZip(renderDocxBuffer(source,'curly',fillMappings(mappings,{},inherited))).file('word/document.xml').asText();
  assert.ok(empty.includes('{{Date_HD}} / {{Date_Thanhtoan}}'));
  assert.ok(empty.includes('<w:b/>'));
});