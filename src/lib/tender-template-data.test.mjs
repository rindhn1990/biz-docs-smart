import { it } from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { tenderExportData, tenderMappings, reorderedRows } from './tender-template-data.ts';
import { fillMappings } from './template-values.ts';
import { renderDocxBuffer } from './docx.ts';

it('fills the reported Word regions from real source fields, never examples', () => {
 const mappings=tenderMappings(['TEN_GOI_THAU','Cv_chutruong','Date_chutruong','Num_PVCV'].map(placeholder=>({placeholder,source_field:null,value:'EXAMPLE'})));
 const data=tenderExportData({Ten_goi_thau:'Gói A'},[{field_key:'Numb_CVCT',value:'198/KTCN'},{field_key:'Date_CVCT',value:'16/09/2026'},{field_key:'Numb_SOW',value:'KVN.KTCN.PVCV.31'},{field_key:'Cv_chutruong',value:null}]);
 const values=fillMappings(mappings,data,new Map());
 assert.deepEqual(values,{TEN_GOI_THAU:'Gói A',Cv_chutruong:'198/KTCN',Date_chutruong:'16/09/2026',Num_PVCV:'KVN.KTCN.PVCV.31'});
 const zip=new PizZip();
 zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{Cv_chutruong}} / {{Date_chutruong}}</w:t></w:r></w:p></w:body></w:document>');
 const xml=new PizZip(renderDocxBuffer(zip.generate({type:'arraybuffer'}),'curly',values)).file('word/document.xml').asText();
 assert.ok(xml.includes('198/KTCN / 16/09/2026'));
 assert.ok(!xml.includes('EXAMPLE'));
});
it('respects a deliberate empty document field and explicit source',()=>{
 const data=tenderExportData({Ten_goi_thau:'Gói A'},[{field_key:'Ten_goi_thau',value:''}]);
 assert.equal(data.Ten_goi_thau,'');
 assert.equal(data['tenders.name'],'');
 assert.equal(tenderMappings([{placeholder:'Cv_chutruong',source_field:'custom',value:null}])[0].source_field,'custom');
});
it('does not borrow values from another tender',()=>{
 assert.equal(tenderExportData({Ten_goi_thau:'Gói B'},[]).Ten_goi_thau,'Gói B');
 assert.equal(fillMappings(tenderMappings([{placeholder:'Cv_chutruong',source_field:null,value:'198/KTCN'}]),tenderExportData({Ten_goi_thau:'Gói B'},[]),new Map()).Cv_chutruong,'');
});
it('moves Date_chutruong next to Cv_chutruong without changing values',()=>{
 const rows=[{id:'Cv_chutruong',sort_order:2,value:'198/KTCN'},{id:'other',sort_order:3,value:'keep'},{id:'Date_chutruong',sort_order:7,value:'16/09/2026'}];
 assert.deepEqual(reorderedRows(rows,2,1).map(r=>[r.id,r.sort_order,r.value]),[['Cv_chutruong',1,'198/KTCN'],['Date_chutruong',2,'16/09/2026'],['other',3,'keep']]);
 assert.deepEqual(rows.map(r=>r.sort_order),[2,3,7]);
});