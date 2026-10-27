import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeScanRows, WholeFileTextCache } from './scan-session.ts';
import { normalizeRegionValue } from './field-extract.ts';

const fields = [{key:'bank_account',label:'Số tài khoản'},{key:'pay_amount',label:'Số tiền'}];
const hit = (key,value,confidence=0.9) => ({key,value,confidence});
describe('Incremental local scan', () => {
  it('keeps first region when second adds a different field', () => {
    const a = mergeScanRows([],fields,[hit('bank_account','0705000003979')],'vùng 1');
    const b = mergeScanRows(a,fields,[hit('pay_amount','1.698.664.015')],'vùng 2');
    assert.equal(b[0].value,'0705000003979'); assert.equal(b[0].source,'vùng 1'); assert.equal(b[1].source,'vùng 2');
  });
  it('never overwrites manual edits', () => {
    const a = mergeScanRows([],fields,[hit('bank_account','123456789')],'toàn trang');
    a[0] = {...a[0],value:'0705000003979',edited:true,source:'nhập tay'};
    assert.equal(mergeScanRows(a,fields,[hit('bank_account','999999999',1)],'vùng 2')[0].value,'0705000003979');
  });
  it('manual clearing is protected too', () => {
    const a = [{...fields[0],value:'',confidence:0,selected:false,source:'nhập tay',edited:true}];
    assert.equal(mergeScanRows(a,fields,[hit('bank_account','999999999')],'vùng 1')[0].value,'');
  });
  it('keeps stronger result and ignores empty results', () => {
    const a = mergeScanRows([],fields,[hit('bank_account','0705000003979',0.95)],'toàn trang');
    assert.equal(mergeScanRows(a,fields,[hit('bank_account','123456789',0.6)],'vùng 1')[0].value,'0705000003979');
    assert.equal(mergeScanRows(a,fields,[hit('bank_account','')],'vùng 2')[0].value,'0705000003979');
  });
  it('preserves automatically calculated source', () => {
    assert.equal(mergeScanRows([],fields,[{...hit('pay_amount','500'),source:'tự tính từ số'}],'vùng 1')[1].source,'tự tính từ số');
  });
  it('normalizes targeted region and ticks it at 0.9', () => {
    const value = normalizeRegionValue(fields[0],'0705 0000 03979');
    const row = mergeScanRows([],fields,[hit('bank_account',value)],'vùng 1')[0];
    assert.equal(row.value,'0705000003979'); assert.equal(row.confidence,0.9); assert.equal(row.selected,true);
  });
  it('normalizes date and money regions', () => {
    assert.equal(normalizeRegionValue({key:'TT_ngay',label:'Ngày'},'ngày 14 tháng 09 năm 2026'),'14/09/2026');
    assert.equal(normalizeRegionValue(fields[1],'1.698.664.015 đồng'),'1.698.664.015');
  });
  it('caches only whole OCR, clears and keys all file attributes', async () => {
    const cache = new WholeFileTextCache(); let calls = 0;
    const read = async () => {calls++; return 'nội dung tài liệu';};
    const file = {name:'test.png',size:100,lastModified:1};
    await cache.read(file,true,read); await cache.read(file,true,read); assert.equal(calls,1);
    await cache.read(file,false,read); await cache.read(file,false,read); assert.equal(calls,3);
    await cache.read({...file,size:101},true,read); await cache.read({...file,lastModified:2},true,read); assert.equal(calls,5);
    cache.clear(); await cache.read(file,true,read); assert.equal(calls,6);
  });
});