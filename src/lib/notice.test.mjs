import { it } from 'node:test';
import assert from 'node:assert/strict';
import { noticeValues, emptyContractorPatch, NOTICE_TEMPLATE_FIELDS } from './notice.ts';
import { readVietnameseMoney } from './money.ts';

const contractor={name:'Nhà thầu A',tax_code:'0314496734',email:'a@example.vn',address:null};
const tender={name:'Gói A',code:'GA',package_value:1698664015};
const link={role:'winner',price:1000000,bid_received_date:'2026-10-31'};
const common={number:'42/TB',date:'31/10/2026',content:'Kết quả'};
it('contractor/tender/common values and received date isolated per recipient',()=>{
 const a=noticeValues(contractor,tender,link,common);
 assert.equal(a.NT_ten,'Nhà thầu A');assert.equal(a.NT_mst,'0314496734');assert.equal(a.GT_ten,'Gói A');assert.equal(a.GT_ma,'GA');
 assert.equal(a.TB_so,'42/TB');assert.equal(a.TB_ngay_ky,'31/10/2026');assert.equal(a.TB_ngay_nhan_hs,'31/10/2026');assert.equal(a.TB_noidung,'Kết quả');
 const b=noticeValues({name:'B'},{name:'Gói B'}, {...link,bid_received_date:null},common);
 assert.equal(b.NT_ten,'B');assert.equal(b.GT_ten,'Gói B');assert.equal(b.TB_ngay_nhan_hs,'');
});
it('money uses shared wording and thousands separators',()=>{
 const v=noticeValues(contractor,tender,link,common);
 assert.equal(v.NT_gia,'1.000.000');assert.equal(v.NT_gia_chu,readVietnameseMoney(1000000));assert.equal(v.GT_gia,'1.698.664.015');assert.equal(v.GT_gia_chu,readVietnameseMoney(1698664015));
});
it('role and absent money',()=>{const v=noticeValues(contractor,{name:'B'}, {...link,role:'bidder',price:null},common);assert.equal(v.NT_vaitro,'Tham dự');assert.equal(v.NT_gia,'');assert.equal(v.GT_gia_chu,'');assert.equal(noticeValues(contractor,tender,link,common).NT_vaitro,'Trúng thầu');});
it('overrides remain export only, explicit blank remains blank',()=>{const v=noticeValues(contractor,tender,link,common,{name:'Override',email:''});assert.equal(v.NT_ten,'Override');assert.equal(v.NT_email,'');assert.equal(contractor.name,'Nhà thầu A');});
it('only empty known contractor columns are patched',()=>assert.deepEqual(emptyContractorPatch({...contractor,phone:'  '},{name:'Other',email:'b@example.vn',address:'  New address  ',phone:'0283 7826 868',id:'bad',tax_code:''}),{address:'New address',phone:'0283 7826 868'}));
it('notice fields include all values without internal metadata',()=>{const keys=NOTICE_TEMPLATE_FIELDS.map(f=>f.key);assert.equal(new Set(keys).size,keys.length);for(const key of Object.keys(noticeValues(contractor,tender,link,common)))assert.ok(keys.includes(key));assert.ok(!keys.includes('_notice_contractor_id'));});