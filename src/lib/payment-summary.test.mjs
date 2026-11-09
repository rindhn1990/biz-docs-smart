import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { summarizePayments } from './payment-summary.ts';

const C = [
  { id: 'a', total_value: '36379792407' },
  { id: 'b', total_value: 2167992000 },
  { id: 'c', total_value: 1000 },
];

describe('summarizePayments', () => {
  it('chỉ cộng đợt paid vào đã thanh toán, tính cả hợp đồng chưa có đợt', () => {
    const { rows, total } = summarizePayments(C, [
      { contract_id: 'a', status: 'paid', total_amount: '2122194115' },
      { contract_id: 'a', status: 'pending', total_amount: 2122194115 },
      { contract_id: 'b', status: 'approved', total_amount: 92340000 },
    ]);
    assert.equal(total.value, 36379792407 + 2167992000 + 1000);
    assert.equal(total.paid, 2122194115);
    assert.equal(total.pending, 2122194115 + 92340000);
    assert.equal(rows[2].paid, 0);
    assert.equal(rows[2].remaining, 1000);
    assert.equal(rows[0].remaining, 36379792407 - 2122194115);
  });
  it('đợt rejected không tính vào đã thanh toán hay đang chờ', () => {
    const { total } = summarizePayments([C[2]], [{ contract_id: 'c', status: 'rejected', total_amount: 500 }]);
    assert.equal(total.paid, 0);
    assert.equal(total.pending, 0);
  });
  it('đánh dấu vượt giá trị hợp đồng', () => {
    const { rows } = summarizePayments([C[2]], [{ contract_id: 'c', status: 'paid', total_amount: 1500 }]);
    assert.equal(rows[0].overpaid, true);
    assert.equal(rows[0].remaining, -500);
  });
  it('tiền lẻ không sai số dấu phẩy động', () => {
    const { total } = summarizePayments([{ id: 'x', total_value: '0.3' }], [
      { contract_id: 'x', status: 'paid', total_amount: 0.1 },
      { contract_id: 'x', status: 'paid', total_amount: 0.2 },
    ]);
    assert.equal(total.paid, 0.3);
    assert.equal(total.remaining, 0);
    assert.equal(total.overpaid, false);
  });
  it('phần trăm null khi giá trị bằng 0', () => {
    assert.equal(summarizePayments([{ id: 'z', total_value: null }], []).total.percent, null);
  });
});
