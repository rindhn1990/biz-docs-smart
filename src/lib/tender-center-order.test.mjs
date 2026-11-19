import { it } from 'node:test';
import assert from 'node:assert/strict';
import { sortCenterFields, centerOrderRows } from './tender-center.ts';
it('saved normalized fields precede new default fields and missing keys are ignored',()=>{
 const fields=[{key:'Ban_CM'},{key:'Num_totrinh_KQ'},{key:'New'}];
 const rows=[{method:'a',field_key:'numtotrinhkq',sort_order:1},{method:'a',field_key:'deleted',sort_order:2}];
 assert.deepEqual(sortCenterFields(fields,rows,'a').map(f=>f.key),['Num_totrinh_KQ','Ban_CM','New']);
 assert.deepEqual(fields.map(f=>f.key),['Ban_CM','Num_totrinh_KQ','New']);
});
it('upsert rows use normalized keys and continuous positions, isolated by method',()=>{
 const a=centerOrderRows('dam_phan_truc_tiep',['B','A','a'],'user');
 const b=centerOrderRows('chi_dinh_thau_rut_gon',['A','B'],null);
 assert.deepEqual(a.map(r=>[r.field_key,r.sort_order]),[['b',1],['a',2]]);
 const fields=[{key:'A'},{key:'B'}];
 assert.deepEqual(sortCenterFields(fields,[...a,...b],'dam_phan_truc_tiep').map(f=>f.key),['B','A']);
 assert.deepEqual(sortCenterFields(fields,[...a,...b],'chi_dinh_thau_rut_gon').map(f=>f.key),['A','B']);
 assert.equal(a[0].updated_by,'user');
});