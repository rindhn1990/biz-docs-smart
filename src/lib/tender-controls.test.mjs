import { it } from 'node:test';
import assert from 'node:assert/strict';
import { orderedTenderTemplates, signerValues, suggestionsForModule } from './tender-controls.ts';
import { centerExportValues } from './tender-center.ts';
import { tenderMappings } from './tender-template-data.ts';
import { fillMappings } from './template-values.ts';

it('Word order belongs to each tender and does not mutate shared template order', () => {
  const templates = [{id:'first'},{id:'second'},{id:'new'}];
  assert.deepEqual(orderedTenderTemplates(templates,[{template_id:'second',sort_order:1},{template_id:'first',sort_order:2}]).map(t=>t.id),['second','first','new']);
  assert.deepEqual(orderedTenderTemplates(templates,[]).map(t=>t.id),['first','second','new']);
  assert.deepEqual(templates.map(t=>t.id),['first','second','new']);
});
it('tender suggestions exclude HR even when HR uses the same placeholder', () => {
  const rows=[{module:'hr',placeholder:'Sign_Photong',label:'HR'},{module:'tender',placeholder:'Sign_Photong',label:'Tender'},{module:'payment',placeholder:'HD_so'},{module:'tender',placeholder:'SIGN_PHOTONG',label:'Older'}];
  assert.deepEqual(suggestionsForModule(rows,'tender').map(r=>r.label),['Tender']);
  assert.deepEqual(suggestionsForModule(rows,'hr').map(r=>r.label),['HR']);
});
it('selecting a signer fills exactly the three linked fields and preserves another tender', () => {
  const a={Sign_PhoTong:'Old',UQ_Photong:'Old',Date_UQ_Photong:'01/01/2026',Ten_goi_thau:'Gói A'};
  const b={Sign_Photong:'B',UQ_photong:'B-UQ',Date_UQ_Photong:'02/01/2026'};
  const next=signerValues(a,{id:'one',name:'Nguyễn Văn A',authorization_number:'198/UQ',authorization_date:'13/11/2026'});
  assert.equal(next.Sign_PhoTong,'Nguyễn Văn A');
  assert.equal(next.Sign_Photong,'Nguyễn Văn A');
  assert.equal(next.UQ_photong,'198/UQ');
  assert.equal(next.UQ_Photong,'198/UQ');
  assert.equal(next.Date_UQ_Photong,'13/11/2026');
  assert.equal(next.Ten_goi_thau,'Gói A');
  assert.equal(a.Sign_PhoTong,'Old');
  assert.equal(b.UQ_photong,'B-UQ');
});
it('signer fields fill Word aliases and removing selection blanks all three without examples', () => {
  const mappings=tenderMappings([{placeholder:'Sign_PhoTong',source_field:null,value:'EXAMPLE'},{placeholder:'UQ_Photong',source_field:null,value:'EXAMPLE'},{placeholder:'Date_UQ_Photong',source_field:null,value:'EXAMPLE',date_format:'vn_full'}]);
  const selected=signerValues({}, {id:'a',name:'Nguyễn Văn A',authorization_number:'198/UQ',authorization_date:'13/11/2026'});
  assert.deepEqual(fillMappings(mappings,centerExportValues(selected),new Map()),{Sign_PhoTong:'Nguyễn Văn A',UQ_Photong:'198/UQ',Date_UQ_Photong:'ngày 13 tháng 11 năm 2026'});
  assert.deepEqual(fillMappings(mappings,centerExportValues(signerValues(selected,null)),new Map()),{Sign_PhoTong:'',UQ_Photong:'',Date_UQ_Photong:''});
});