import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { DOMParser } from '@xmldom/xmldom';
import { replacePhraseWithToken, applyDocxParagraphEdits, listDocxParagraphs, docxPlainText } from './docx.ts';
import { WORD_TEXT_RE, assertSafeDocxEdit, validateDocx, previousDocxPath } from './docx-safety.ts';

const phrase = 'Tổ chức khóa đào tạo';
const xml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>V/v ${phrase}</w:t></w:r></w:p>
<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="540"/></w:tabs></w:pPr><w:r><w:tab/><w:t xml:space="preserve">Thư cho gói thầu “${phrase}”.</w:t></w:r></w:p>
<w:p><w:r><w:tab/><w:t>Đoạn phía dưới giữ nguyên</w:t></w:r></w:p>
<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single"/></w:tblBorders></w:tblPr><w:tr><w:tc><w:tcPr/><w:p><w:r><w:t>Ô bảng giữ nguyên</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p/><w:p><w:r><w:t/></w:r></w:p><w:p><w:r><w:t>Cuối văn bản</w:t></w:r></w:p>
</w:body></w:document>`;
function make(value = xml) {
  const zip = new PizZip();
  zip.file('word/document.xml', value);
  zip.file('word/styles.xml', '<styles/>');
  zip.file('word/header1.xml', '<header/>');
  zip.file('word/footer1.xml', '<footer/>');
  zip.file('word/media/image.png', new Uint8Array([0, 128, 255, 12]));
  return zip.generate({type:'arraybuffer'});
}
const source = make();
const getXml = buffer => new PizZip(buffer).file('word/document.xml').asText();
describe('Word template corruption regression', () => {
  it('reproduces legacy regex matching tabs and creating mismatched XML', () => {
    const broken = xml.replace(/(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/g, (_, open, text, close) => open.replace(/>$/, ' xml:space="preserve">') + text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + close);
    assert.throws(() => new DOMParser({onError: () => {throw new Error('invalid');}}).parseFromString(broken,'application/xml'));
    assert.throws(() => validateDocx(make(broken)), /Không lưu để tránh làm hỏng file mẫu/);
  });
  it('matches only non-self-closing w:t including xml:space', () => {
    const sample = '<w:tabs><w:tab/><w:top/><w:tbl/><w:tcPr/><w:t/><w:t >x</w:t><w:t xml:space="preserve"> y </w:t>';
    const hits = [...sample.matchAll(new RegExp(WORD_TEXT_RE.source,'g'))];
    assert.deepEqual(hits.map(m=>m[2]),['x',' y ']);
  });
  it('replaces exactly two paragraphs, preserves tabs/tables/empty paragraphs and all package parts', () => {
    const result = replacePhraseWithToken(source,phrase,'{{Ten_Goi_thau}}');
    assert.equal(result.count,2);
    validateDocx(result.buffer);
    assert.equal(listDocxParagraphs(result.buffer).length,listDocxParagraphs(source).length);
    assert.deepEqual(listDocxParagraphs(result.buffer),listDocxParagraphs(source).map(t=>t.replace(phrase,'{{Ten_Goi_thau}}')));
    assert.ok(getXml(result.buffer).includes('<w:tabs><w:tab w:val="left" w:pos="540"/></w:tabs>'));
    assert.ok(getXml(result.buffer).includes('<w:r><w:tab/><w:t xml:space="preserve">'));
    for (const name of ['word/styles.xml','word/header1.xml','word/footer1.xml','word/media/image.png']) {
      assert.deepEqual(new PizZip(result.buffer).file(name).asUint8Array(),new PizZip(source).file(name).asUint8Array());
    }
    const reverse = replacePhraseWithToken(result.buffer,'{{Ten_Goi_thau}}',phrase);
    assert.deepEqual(listDocxParagraphs(reverse.buffer),listDocxParagraphs(source));
    assert.equal(docxPlainText(reverse.buffer),docxPlainText(source));
  });
  it('keeps lower text through three sequential region edits and reopening', () => {
    let buffer = source;
    for (const [needle,token] of [[phrase,'{{Ten_Goi_thau}}'],['V/v','{{Loai}}'],['Thư','{{Thu}}']]) buffer = replacePhraseWithToken(buffer,needle,token).buffer;
    const reopened = new PizZip(buffer).generate({type:'arraybuffer'});
    validateDocx(reopened);
    assert.ok(docxPlainText(reopened).endsWith('Cuối văn bản'));
    assert.ok(docxPlainText(reopened).includes('Ô bảng giữ nguyên'));
  });
  it('paragraph editor keeps tab markup and changes only intended text', () => {
    const expected = listDocxParagraphs(source);
    expected[1] += ' Đã sửa';
    const next = applyDocxParagraphEdits(source,expected);
    assert.deepEqual(listDocxParagraphs(next),expected);
    assert.ok(getXml(next).includes('<w:tab/>'));
  });
  it('blocks changed media, lost paragraph, changed tab and unintended text', () => {
    const expected = listDocxParagraphs(source);
    const media = new PizZip(source); media.file('word/media/image.png',new Uint8Array([1]));
    assert.throws(()=>assertSafeDocxEdit(source,media.generate({type:'arraybuffer'}),expected));
    assert.throws(()=>assertSafeDocxEdit(source,make(xml.replace('<w:p/>','')),expected));
    assert.throws(()=>assertSafeDocxEdit(source,make(xml.replace('w:pos="540"','w:pos="999"')),expected));
    assert.throws(()=>assertSafeDocxEdit(source,make(xml.replace('Cuối văn bản','Mất nội dung')),expected));
  });
  it('keeps exactly one same-directory backup filename', () => assert.equal(previousDocxPath('templates/example/source.docx'),'templates/example/source.prev.docx'));
});