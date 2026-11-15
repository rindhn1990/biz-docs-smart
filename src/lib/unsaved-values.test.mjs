import { it } from 'node:test';
import assert from 'node:assert/strict';
import { hasUnsavedValues } from './unsaved-values.ts';

it('manual changes and clearing a saved value require a save decision', () => {
  assert.equal(hasUnsavedValues({name:'New'}, {name:'Saved'}), true);
  assert.equal(hasUnsavedValues({name:''}, {name:'Saved'}), true);
});
it('returning to the saved version removes the warning without changing the saved values', () => {
  const saved = {name:'Saved',date:'15/11/2026'};
  const current = {...saved,name:'Draft'};
  assert.equal(hasUnsavedValues(current,saved),true);
  assert.equal(hasUnsavedValues({...saved},saved),false);
  assert.equal(saved.name,'Saved');
});
it('empty unused fields and field order are not unsaved data', () => {
  assert.equal(hasUnsavedValues({b:'2',a:'1',empty:''},{a:'1',b:'2'}),false);
});