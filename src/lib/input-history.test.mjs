import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createInputHistory, changeInputHistory, undoInputHistory, redoInputHistory } from './input-history.ts';

it('undo and redo manual typing across fields restore the previous values including blanks', () => {
  let h = createInputHistory({Cv_chutruong:'198',Date_chutruong:''});
  h = changeInputHistory(h,{...h.present,Cv_chutruong:'198/A'});
  h = changeInputHistory(h,{...h.present,Date_chutruong:'15/11/2026'});
  h = undoInputHistory(h);
  assert.deepEqual(h.present,{Cv_chutruong:'198/A',Date_chutruong:''});
  h = undoInputHistory(h);
  assert.equal(h.present.Cv_chutruong,'198');
  h = redoInputHistory(redoInputHistory(h));
  assert.deepEqual(h.present,{Cv_chutruong:'198/A',Date_chutruong:'15/11/2026'});
});
it('new typing after undo clears redo and duplicate values do not create a step', () => {
  const start=createInputHistory({name:'Gói A'});
  assert.equal(changeInputHistory(start,{name:'Gói A'}),start);
  const changed=changeInputHistory(undoInputHistory(changeInputHistory(start,{name:'Gói B'})),{name:'Gói C'});
  assert.equal(changed.future.length,0);
  assert.equal(redoInputHistory(changed).present.name,'Gói C');
});
it('money and its generated wording undo together; loading another tender resets history', () => {
  const first=createInputHistory({amount:'100',words:'Một trăm đồng'});
  const changed=changeInputHistory(first,{amount:'200',words:'Hai trăm đồng'});
  assert.deepEqual(undoInputHistory(changed).present,first.present);
  const other=createInputHistory({amount:'300',words:'Ba trăm đồng'});
  assert.equal(undoInputHistory(other).present.amount,'300');
  assert.equal(other.past.length,0);
  assert.deepEqual(first.present,{amount:'100',words:'Một trăm đồng'});
});