import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractFieldsLocally } from './field-extract.ts';
import { CONTRACTOR_SCAN_FIELDS } from './contractor.ts';

const text = `GIẤY CHỨNG NHẬN ĐĂNG KÝ DOANH NGHIỆP
Mã số doanh nghiệp: 0314496734
1. Tên công ty
Tên công ty viết bằng tiếng Việt: CÔNG TY TNHH THƯƠNG MẠI
DỊCH VỤ VẬN TẢI VIETTRANS
Tên công ty viết bằng tiếng nước ngoài: VIETTRANS TRANSPORT COMPANY
Tên công ty viết tắt: VIETTRANS
2. Địa chỉ trụ sở chính:
Số 673 Nguyễn Hữu Thọ, Xã Nhà Bè,
Thành phố Hồ Chí Minh, Việt Nam
Điện thoại: 0283 7826 868 Fax: 0283 9999 999
Email: contact@viettrans.vn Website: viettrans.vn
3. Vốn điều lệ: 10.000.000.000 đồng
4. Người đại diện theo pháp luật
Họ và tên: NGUYỄN QUANG BÌNH Giới tính: Nam
Chức danh: Giám đốc Sinh ngày: 01/01/1980`;
const expected = {
 name:'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ VẬN TẢI VIETTRANS',
 tax_code:'0314496734',
 address:'Số 673 Nguyễn Hữu Thọ, Xã Nhà Bè, Thành phố Hồ Chí Minh, Việt Nam',
 phone:'0283 7826 868',email:'contact@viettrans.vn',representative:'NGUYỄN QUANG BÌNH',representative_title:'Giám đốc',
};
const fold = s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D');
describe('business registration, no AI',()=>{
 for(const [mode,input] of [['standard',text],['unaccented OCR',fold(text).replace('viet bang tieng Viet','viét bang tiéng Viét').replace('Dien thoai','Dien thoal')]]) {
  const values=Object.fromEntries(extractFieldsLocally(input,CONTRACTOR_SCAN_FIELDS).map(v=>[v.key,v.value]));
  for(const [key,value] of Object.entries(expected))it(`${mode}: ${key}`,()=>assert.equal(values[key],mode==='standard'?value:fold(value)));
  it(`${mode}: no bank/account guessing`,()=>{assert.equal(values.bank_account,undefined);assert.equal(values.bank_name,undefined);assert.equal(Object.keys(values).length,7);});
 }
 for(const tax of ['0314496734','0314496734001','0314496734-001'])it(`tax ${tax}`,()=>assert.equal(extractFieldsLocally(text.replace('0314496734',tax),CONTRACTOR_SCAN_FIELDS).find(v=>v.key==='tax_code')?.value,tax));
});