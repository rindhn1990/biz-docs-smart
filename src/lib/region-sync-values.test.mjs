import { it } from 'node:test';
import assert from 'node:assert/strict';
import { planRegionFields, regionDestination, centerFieldUsage } from './region-sync-values.ts';
import { regionGroupChanges, scopeRegionTemplates, groupRegions } from './region-directory.ts';
const r=(placeholder,source_field=null,label=placeholder)=>({template_id:'a',placeholder,source_field,label,value:null});
const method='dam_phan_truc_tiep';
it('sync only adds effective sources to linked documents of matching method',()=>{
 const docs=[{id:'yes',tender_id:'t',method},{id:'wrong',tender_id:'w',method:'other'},{id:'none',tender_id:null,method}];
 const result=planRegionFields([r('Ban_Chuyen_mon','Ban_CM'),r('BAN_CM','Ban_CM')],docs,[],new Map(),method);
 assert.deepEqual(result.map(x=>[x.document_id,x.field_key,x.label,x.sort_order]),[['yes','Ban_CM','Ban chuyên môn',1]]);
 assert.equal(result[0].value,null);assert.equal(result[0].needs_review,true);assert.equal(result[0].confidence,0.3);
});
it('sync skips existing normalized source keys, fixed groups and unclassified methods',()=>{
 const docs=[{id:'d',tender_id:'t',method}];
 const have=[{document_id:'d',field_key:'ban_cm',field_group:'Khác',sort_order:10}];
 assert.deepEqual(planRegionFields([r('Ban_Chuyen_mon','Ban_CM'),r('Ten_Goi_thau'),r('Sign_Photong')],docs,have,new Map(),method),[]);
 assert.deepEqual(planRegionFields([r('new')],docs,[],new Map(),null),[]);
 assert.equal(planRegionFields([r('new')],docs,have,new Map(),method)[0].sort_order,11);
});
it('inherited effective source does not create the raw placeholder field',()=>{
 const result=planRegionFields([r('Ban_Chuyen_mon')],[{id:'d',tender_id:'t',method}],[],new Map([['banchuyenmon','Ban_CM']]),method);
 assert.equal(result[0].field_key,'Ban_CM');
});
it('three independent newest fields report new inputs, shared sources report their existing destination',()=>{
 for(const region of [r('Ban_Chuyen_mon','Ban_CM','Ban chuyên môn'),r('Date_totrinh_KQ'),r('Num_totrinh_KQ')]) assert.match(regionDestination(region,[region],new Map(),method),/Đã thêm trường mới.*Đàm phán trực tiếp/);
 const old=r('Ban_cu','Ban_CM','Ban chuyên môn'),fresh=r('Ban_Chuyen_mon','Ban_CM');
 assert.match(regionDestination(fresh,[old,fresh],new Map(),method),/dùng chung.*Ban chuyên môn.*2 ký hiệu/);
 assert.match(regionDestination(r('Ten_Goi_thau'),[r('Ten_Goi_thau')],new Map(),method),/nhóm 'Thông tin gói thầu'/);
 assert.match(regionDestination(r('Date_chutruong'),[],new Map(),method),/nhóm 'Văn bản – chữ ký'/);
});
it('bulk patches target only normalized symbol in selected method; no placeholder mutation',()=>{
 const templates=[{id:'a',module:'tender',method},{id:'b',module:'tender',method},{id:'c',module:'tender',method:'other'}];
 const rows=templates.map(t=>({...r(t.id==='b'?'Nhathau_1':'nhathau_1'),id:t.id,template_id:t.id,updated_at:'stamp'}));
 const changes=regionGroupChanges(rows,scopeRegionTemplates(templates,'tender',method),'NHATHAU_1',{label:'Nhà thầu',source_field:'NT_ten',date_format:null});
 assert.deepEqual(changes.map(c=>c.id),['a','b']); assert.equal(changes[0].expected_updated_at,'stamp');assert.equal(Object.hasOwn(changes[0],'placeholder'),false);
 assert.equal(regionGroupChanges(rows,scopeRegionTemplates(templates,'tender',method,true),'nhathau_1',{}).length,3);
});
it('detects individual label, date and example differences',()=>{
 for(const patch of [{label:'Other'},{date_format:'slash'},{value:'example'},{source_field:'other'}]) {
  const rows=[{...r('date'),id:'1'},{...r('DATE'),id:'2',...patch}];
  assert.equal(groupRegions(rows,[{id:'a',module:'tender'}])[0].conflict,true);
 }
});
it('usage lists all folded aliases and flags only fields within three days',()=>{
 const now=Date.parse('2026-11-19T04:48:00Z');
 const rows=[{...r('Ban_Chuyen_mon','Ban_CM'),created_at:'2026-11-17T00:00:00Z'},{...r('Ban_cu','Ban_CM'),template_id:'b',created_at:'2026-11-01T00:00:00Z'}];
 const usage=centerFieldUsage('Ban_CM',rows,new Map(),now);assert.equal(usage.symbols,2);assert.equal(usage.templates,2);assert.equal(usage.isNew,true);
 assert.equal(centerFieldUsage('Ban_CM',rows.slice(1),new Map(),now).isNew,false);
});