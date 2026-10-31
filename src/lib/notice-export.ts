import PizZip from 'pizzip';
import { withTimestampedName } from './docx';

function safePart(value: string) { return value.normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\s+/g, '_').slice(0,100) || 'KhongTen'; }
export function noticeFileName(contractor: string, template: string, at = new Date()) {
  return withTimestampedName(`ThongBao_${safePart(contractor)}_${safePart(template)}.docx`, at);
}
export function packageNoticeFiles(files: {name: string; buffer: ArrayBuffer}[], at = new Date()): {name: string; blob: Blob; fileNames: string[]} {
  if (!files.length) throw new Error('Chưa có file để xuất');
  if (files.length === 1) {
    const file = files[0];
    if (!file) throw new Error('Chưa có file');
    return {name:file.name, fileNames:[file.name], blob:new Blob([file.buffer],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})};
  }
  const zip = new PizZip(); const used = new Set<string>(); const fileNames:string[]=[];
  for (const file of files) {
    let name = file.name, index = 2;
    while (used.has(name)) name = /\.docx$/i.test(file.name) ? file.name.replace(/\.docx$/i, `_${index++}.docx`) : `${file.name}_${index++}`;
    used.add(name); fileNames.push(name); zip.file(name,file.buffer);
  }
  return { name:withTimestampedName('ThongBao.docx',at).replace(/\.docx$/,'.zip'), fileNames, blob:new Blob([zip.generate({type:'arraybuffer',compression:'DEFLATE'})],{type:'application/zip'}) };
}