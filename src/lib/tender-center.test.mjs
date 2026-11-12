import { it } from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { centerFields, centerExportValues, resetCenterValues, centerTemplatesForMethod } from './tender-center.ts';
import { tenderMappings } from './tender-template-data.ts';
import { fillMappings } from './template-values.ts';
import { renderDocxBuffer } from './docx.ts';

it('procurement method automatically supplies only corresponding templates and input fields', () => {
 const templates=[{id:'a',method:'chi_dinh_thau_rut_gon'},{id:'b',method:'dam_phan_truc_tiep'},{id:'c',method:null}];
 const definitions=[{template_id:'a',placeholder:'So_chi_dinh',source_field:null,value:null},{template_id:'b',placeholder:'So_dam_phan',source_field:null,value:null}];
 const selected=centerTemplatesForMethod(templates,'chi_dinh_thau_rut_gon');
 assert.deepEqual(selected.map(t=>t.id),['a']);
 assert.deepEqual(centerFields(definitions.filter(m=>selected.some(t=>t.id===m.template_id)),new Map(),[]).map(f=>f.key),['So_chi_dinh']);
 assert.deepEqual(centerTemplatesForMethod(templates,'dam_phan_truc_tiep').map(t=>t.id),['b']);
 assert.deepEqual(centerTemplatesForMethod(templates,null),[]);
 assert.deepEqual(centerTemplatesForMethod(templates,'dau_thau_rong_rai_2_tui'),[]);
});

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
it('one saved Word definition is reused by two packages without copying definitions or values', () => {
 const definitions = [{placeholder:'Ma_thong_bao',label:'Số thông báo',source_field:'notice_number',value:'EXAMPLE'}];
 const fields = centerFields(definitions,new Map(),[]);
 assert.deepEqual(fields,[{key:'notice_number',label:'Số thông báo'}]);
 const mappings=tenderMappings(definitions);
 assert.equal(fillMappings(mappings,centerExportValues({notice_number:'01/GÓI-A'}),new Map()).Ma_thong_bao,'01/GÓI-A');
 assert.equal(fillMappings(mappings,centerExportValues({notice_number:'02/GÓI-B'}),new Map()).Ma_thong_bao,'02/GÓI-B');
 assert.equal(fillMappings(mappings,centerExportValues({}),new Map()).Ma_thong_bao,'');
 assert.equal(definitions[0].value,'EXAMPLE');
});
it('newly defined regions and inherited sources become package inputs without redefining', () => {
 const inherited=new Map([['sothongbao','notice_number']]);
 const definitions=[{placeholder:'So_thong_bao',source_field:null,value:null},{placeholder:'Ngay_moi',source_field:'notice_date',value:null}];
 assert.deepEqual(centerFields(definitions,inherited,[]).map(f=>f.key),['notice_number','notice_date']);
 assert.deepEqual(fillMappings(tenderMappings(definitions),centerExportValues({notice_number:'15/TB',notice_date:'12/11/2026'}),inherited),{So_thong_bao:'15/TB',Ngay_moi:'12/11/2026'});
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