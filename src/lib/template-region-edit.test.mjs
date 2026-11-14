import { it } from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { renameRegionToken, validateRegionKey } from './template-region-edit.ts';
import { renderDocxBuffer } from './docx.ts';

const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
function fixture() {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', `<w:document ${ns}><w:body><w:p><w:pPr><w:tabs><w:tab w:val="left"/></w:tabs></w:pPr><w:r><w:tab/><w:t>{{ Old</w:t></w:r><w:r><w:t>_key }}</w:t></w:r><w:r><w:t> / {{Old_key}} / {{Old_key_extra}}</w:t></w:r></w:p><w:p></w:p><w:tbl><w:tr><w:tc><w:tcPr/><w:p><w:r><w:t>[[Old_key]]</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>Nội dung cuối</w:t></w:r></w:p></w:body></w:document>`);
  zip.file('word/header1.xml', `<w:hdr ${ns}><w:p><w:r><w:t>{{Old_key}}</w:t></w:r></w:p></w:hdr>`);
  zip.file('word/footer1.xml', `<w:ftr ${ns}><w:p><w:r><w:t>[[Old_key]]</w:t></w:r></w:p></w:ftr>`);
  zip.file('word/media/image1.png', new Uint8Array([1, 2, 3]));
  return zip.generate({ type: 'arraybuffer' });
}
it('renames all exact existing regions across runs, tables, header/footer and preserves unrelated bytes', () => {
  const source = fixture();
  const { buffer, count } = renameRegionToken(source, 'Old_key', 'New_key');
  assert.equal(count, 5);
  const zip = new PizZip(buffer);
  const xml = zip.file('word/document.xml').asText();
  assert.ok(xml.includes('{{ New_key'));
  assert.ok(xml.includes('{{Old_key_extra}}'));
  assert.ok(xml.includes('<w:tabs><w:tab w:val="left"/></w:tabs>'));
  assert.ok(xml.includes('<w:p></w:p>'));
  assert.ok(xml.includes('Nội dung cuối'));
  assert.ok(zip.file('word/header1.xml').asText().includes('{{New_key}}'));
  assert.deepEqual(zip.file('word/media/image1.png').asUint8Array(), new Uint8Array([1, 2, 3]));
});
it('renamed symbol still fills manual data while missing data keeps the new token', () => {
  const { buffer } = renameRegionToken(fixture(), 'Old_key', 'New_key');
  const filled = new PizZip(renderDocxBuffer(buffer, 'curly', { New_key: '198/KTCN' })).file('word/document.xml').asText();
  assert.ok(filled.includes('198/KTCN'));
  const blank = new PizZip(renderDocxBuffer(buffer, 'curly', {})).file('word/document.xml').asText();
  assert.ok(blank.includes('New_key'));
});
it('rejects duplicate/invalid symbols and does not rewrite plain text', () => {
  assert.throws(() => validateRegionKey('Existing', ['Old_key', 'Existing'], 'Old_key'), /đã có/);
  assert.throws(() => validateRegionKey('bad key', []), /Ký hiệu/);
  assert.equal(validateRegionKey('{{New_key}}', []), 'New_key');
  const result = renameRegionToken(fixture(), 'Absent', 'New_key');
  assert.equal(result.count, 0);
});
it('successive symbol edits preserve values through the pinned source and keep unrelated regions', () => {
  const first = renameRegionToken(fixture(), 'Old_key', 'Date_chutruong');
  const second = renameRegionToken(first.buffer, 'Date_chutruong', 'Date_chutruong_new');
  assert.equal(first.count, 5);
  assert.equal(second.count, 5);
  const output = new PizZip(renderDocxBuffer(second.buffer, 'curly', { Date_chutruong_new: '16/09/2026' }));
  const xml = output.file('word/document.xml').asText();
  assert.ok(xml.includes('16/09/2026'));
  assert.ok(xml.includes('{{Old_key_extra}}'));
  assert.ok(xml.includes('Nội dung cuối'));
  assert.deepEqual(output.file('word/media/image1.png').asUint8Array(), new Uint8Array([1, 2, 3]));
});
it('an absent region does not change any DOCX package entry', () => {
  const source = fixture();
  const result = renameRegionToken(source, 'Not_in_template', 'New_key');
  assert.equal(result.count, 0);
  const before = new PizZip(source);
  const after = new PizZip(result.buffer);
  assert.deepEqual(Object.keys(after.files).sort(), Object.keys(before.files).sort());
  for (const name of Object.keys(before.files)) {
    if (before.files[name].dir) continue;
    assert.deepEqual(after.file(name).asUint8Array(), before.file(name).asUint8Array());
  }
});