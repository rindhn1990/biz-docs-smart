import { it } from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { centerFields, centerExportValues, resetCenterValues } from './tender-center.ts';
import { tenderMappings } from './tender-template-data.ts';
import { fillMappings } from './template-values.ts';
import { renderDocxBuffer } from './docx.ts';

it('Word-defined sources become editable package fields, deduplicated without examples', () => {
 const fields = centerFields([
  {placeholder:'Cv_chutruong',source_field:null,value:'EXAMPLE'},
  {placeholder:'Date_chutruong',source_field:null,value:'16/9/2026'},
  {placeholder:'Another',source_field:'Numb_CVCT',value:null},
  {placeholder:'custom',source_field:null,value:'not data'},
 ],new Map(),[]);
 assert.deepEqual(fields.map(f=>f.key),['so_van_ban_chu_truong','ngay_van_ban_chu_truong','custom']);
});
it('manual package values export automatically and never borrow from another package', () => {
 const mappings=tenderMappings([{placeholder:'Cv_chutruong',source_field:null,value:'EXAMPLE'}]);
 assert.equal(fillMappings(mappings,centerExportValues({so_van_ban_chu_truong:'198/KTCN'}),new Map()).Cv_chutruong,'198/KTCN');
 assert.equal(fillMappings(mappings,centerExportValues({ten_goi_thau:'Gói B'}),new Map()).Cv_chutruong,'');
});
it('reset blanks package data without changing original or field definitions and Word keeps tokens', () => {
 const original={ten_goi_thau:'Gói A',so_van_ban_chu_truong:'198/KTCN'};
 const reset=resetCenterValues(original,Object.keys(original).map(key=>({key})));
 assert.deepEqual(reset,{ten_goi_thau:'',so_van_ban_chu_truong:''});
 assert.equal(original.ten_goi_thau,'Gói A');
 const mappings=tenderMappings([{placeholder:'ten_goi_thau',source_field:null,value:'EXAMPLE'}]);
 const values=fillMappings(mappings,centerExportValues(reset),new Map());
 const zip=new PizZip();
 zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{ten_goi_thau}}</w:t></w:r></w:p></w:body></w:document>');
 const xml=new PizZip(renderDocxBuffer(zip.generate({type:'arraybuffer'}),'curly',values)).file('word/document.xml').asText();
 assert.ok(xml.includes('{{ten_goi_thau}}'));
 assert.ok(!xml.includes('EXAMPLE'));
});