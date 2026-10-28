import PizZip from 'pizzip';
import { withTimestampedName } from './docx';

function safePart(value: string) { return value.normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\s+/g, '_').slice(0,100) || 'KhongTen'; }
export function noticeFileName(contractor: string, template: string, at = new Date()) {
  return withTimestampedName(`ThongBao_${safePart(contractor)}_${safePart(template)}.docx`, at);
}
export function packageNoticeFiles(files: {name: string; buffer: ArrayBuffer}[], at = new Date()): {name: string; blob: Blob} {
  if (!files.length) throw new Error('Chưa có file để xuất');
  if (files.length === 1) {
    const file = files[0];
    if (!file) throw new Error('Chưa có file');
    return {name:file.name, blob:new Blob([file.buffer],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})};
  }
  const zip = new PizZip(); const used = new Set<string>();
  for (const file of files) {
    let name = file.name, index = 2;
    while (used.has(name)) name = file.name.replace(/\.docx$/i, `_${index++}.docx`);
    used.add(name); zip.file(name,file.buffer);
  }
  return { name:withTimestampedName('ThongBao.docx',at).replace(/\.docx$/,'.zip'), blob:new Blob([zip.generate({type:'arraybuffer',compression:'DEFLATE'})],{type:'application/zip'}) };
}