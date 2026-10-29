import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { writeTemplateWithBackup, restoreTemplateBackup } from './template-file-ops.ts';
const path='templates/test/source.docx', backup='templates/test/source.prev.docx';
function file(text) { const zip=new PizZip(); zip.file('word/document.xml',`<w:document xmlns:w="urn:test"><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:document>`);return zip.generate({type:'arraybuffer'}); }
function storage(original=file('original')) {
  const files=new Map([[path,original]]), writes=[];
  return {files,writes,store:{read:async p=>{if(!files.has(p))throw new Error('missing');return files.get(p);},write:async(p,b)=>{writes.push(p);files.set(p,b);}}};
}
describe('Safe template backup and undo',()=>{
 it('backs up before overwrite and keeps only most recent prior version',async()=>{
  const s=storage(), second=file('second'), third=file('third');
  await writeTemplateWithBackup(s.store,path,second,true);
  assert.deepEqual(s.writes,[backup,path]);
  await writeTemplateWithBackup(s.store,path,third,true);
  assert.deepEqual(s.files.get(backup),second);assert.equal(s.files.size,2);
 });
 it('aborts source overwrite if backup fails',async()=>{
  const s=storage(),original=s.files.get(path);
  s.store.write=async()=>{throw new Error('backup failed');};
  await assert.rejects(writeTemplateWithBackup(s.store,path,file('next'),true));
  assert.deepEqual(s.files.get(path),original);
 });
 it('rejects invalid XML before reading or writing storage',async()=>{
  const s=storage();const zip=new PizZip();zip.file('word/document.xml','<w:p><w:tabs></w:t>');
  await assert.rejects(writeTemplateWithBackup(s.store,path,zip.generate({type:'arraybuffer'}),true),/Không lưu để tránh làm hỏng file mẫu/);
  assert.equal(s.writes.length,0);
 });
 it('rejects stale editor source before backup or overwrite',async()=>{
  const s=storage(file('concurrent edit'));
  await assert.rejects(writeTemplateWithBackup(s.store,path,file('next'),true,file('old cached')),/File đã thay đổi/);
  assert.equal(s.writes.length,0);
 });
 it('restores latest backup and refuses missing backup without writes',async()=>{
  const s=storage();await assert.rejects(restoreTemplateBackup(s.store,path));assert.equal(s.writes.length,0);
  const previous=s.files.get(path);await writeTemplateWithBackup(s.store,path,file('second'),true);
  const result=await restoreTemplateBackup(s.store,path);assert.deepEqual(result,previous);assert.deepEqual(s.files.get(path),previous);
 });
 it('allows an explicitly replaced whole file with a different layout',async()=>{
  const s=storage(),zip=new PizZip();zip.file('word/document.xml','<w:document xmlns:w="urn:test"><w:p/><w:p/><w:tbl/></w:document>');zip.file('word/styles.xml','<styles/>');
  await writeTemplateWithBackup(s.store,path,zip.generate({type:'arraybuffer'}),true);
  assert.deepEqual(s.writes,[backup,path]);
 });
});