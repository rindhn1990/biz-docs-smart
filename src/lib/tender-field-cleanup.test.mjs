import {it} from 'node:test';
import assert from 'node:assert/strict';
import {cleanupCandidates,cleanupCsv} from './tender-field-cleanup.ts';
const doc={id:'d',file_name:'File',tender_id:'t',method:'direct',tender_name:'Tender'};
const f=(id,key,patch={})=>({id,document_id:'d',field_key:key,label:key,value:null,needs_review:true,field_group:'Khác',sort_order:999,created_at:'2026-01-01',updated_at:'stamp',...patch});
const run=(fields,docs=[doc],regions=[])=>cleanupCandidates(fields,docs,regions,new Map());
it('empty case-insensitive duplicates keep KHLCNT canonical key then oldest',()=>{
 assert.deepEqual(run([f('1','Ten_Goi_thau'),f('2','Ten_goi_thau')]).candidates.map(r=>r.field.id),['1']);
 assert.deepEqual(run([f('1','CUSTOM'),f('2','custom',{created_at:'2026-02-01'})]).candidates.map(r=>r.field.id),['2']);
});
it('valued duplicate is kept and empty duplicate alone is selected',()=>{
 const result=run([f('1','Ban_CM',{value:'Ban Kế toán'}),f('2','ban_cm')]);
 assert.deepEqual(result.candidates.map(r=>r.field.id),['2']);assert.equal(result.duplicatePairs,1);
});
it('different nonempty values are manual only, never delete even the empty sibling',()=>{
 const result=run([f('1','KEY',{value:'A'}),f('2','key',{value:'B'}),f('3','Key')]);
 assert.equal(result.candidates.length,0);assert.equal(result.manual.length,1);assert.equal(result.manual[0].fields.length,2);
});
it('confirmed fields and fields with data are never selected',()=>{
 assert.equal(run([f('1','key',{needs_review:false}),f('2','KEY',{value:'value'})]).candidates.length,0);
 assert.equal(run([f('1','orphan',{needs_review:false})],[{...doc,tender_id:null}]).candidates.length,0);
});
it('legacy orphan/method mismatch/redirect candidates are limited to empty 999 Other rows',()=>{
 assert.equal(run([f('1','orphan')],[{...doc,tender_id:null}]).candidates.length,1);
 const region={template_id:'a',placeholder:'Ban_Chuyen_mon',source_field:'Ban_CM',label:'Ban',value:null,method:'other'};
 assert.equal(run([f('1','Ban_Chuyen_mon')],[doc],[region]).candidates[0].reason,'Vùng đã dùng nguồn dữ liệu khác');
 assert.equal(run([f('1','Ban_CM')],[doc],[region]).candidates.length,1);
 assert.equal(run([f('1','Ban_CM')],[{...doc,method:'other'}],[region]).candidates.length,0);
 assert.equal(run([f('1','orphan',{sort_order:1}),f('2','valued',{value:'A'}),f('3','wrong-group',{field_group:'Căn cứ'})],[{...doc,tender_id:null}]).candidates.length,0);
});
it('CSV preserves quoted labels and prevents spreadsheet formula execution',()=>{
 const result=run([f('1','=formula',{label:'A "quote"'})],[{...doc,tender_id:null}]);
 const csv=cleanupCsv(result.candidates);assert.ok(csv.includes("'=formula"));assert.ok(csv.includes('A ""quote""'));
});