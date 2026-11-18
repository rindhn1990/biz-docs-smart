import { it } from 'node:test';
import assert from 'node:assert/strict';
import { scopeRegionTemplates, groupRegions, orderedWordFields, reorderWordFields } from './region-directory.ts';

it('nhathau_1 is grouped only across templates in direct negotiation by default', () => {
 const templates=[{id:'a',module:'tender',method:'dam_phan_truc_tiep'},{id:'b',module:'tender',method:'dam_phan_truc_tiep'},{id:'c',module:'tender',method:'chi_dinh_thau_rut_gon'},{id:'hr',module:'hr'}];
 const rows=templates.map(t=>({id:t.id,template_id:t.id,placeholder:'nhathau_1',source_field:null}));
 const scope=scopeRegionTemplates(templates,'tender','dam_phan_truc_tiep');
 assert.deepEqual(groupRegions(rows,scope)[0].rows.map(r=>r.id),['a','b']);
 assert.deepEqual(groupRegions(rows,scopeRegionTemplates(templates,'tender','dam_phan_truc_tiep',true))[0].rows.map(r=>r.id),['a','b','c']);
});
it('normalized symbols group together and source conflicts remain visible', () => {
 const groups=groupRegions([{id:'1',template_id:'a',placeholder:'nhathau_1',source_field:'old'},{id:'2',template_id:'a',placeholder:'nhathau_1',source_field:'other'},{id:'3',template_id:'a',placeholder:'Nhathau_1',source_field:null}],[{id:'a',module:'tender'}]);
 assert.equal(groups.length,1); assert.equal(groups[0].sourceConflict,true); assert.equal(groups[0].conflict,true);
});
it('saved field order overrides template order and newly defined fields are appended', () => {
 assert.deepEqual(orderedWordFields([{key:'a'},{key:'b'},{key:'new'}],['b','a','removed']).map(f=>f.key),['b','a','new']);
});
it('reorder of a filtered template preserves hidden field positions and values', () => {
 const original=['a','hidden','b','c'];
 assert.deepEqual(reorderWordFields(original,['a','b','c'],'c','a'),['c','hidden','a','b']);
 assert.deepEqual(original,['a','hidden','b','c']);
});