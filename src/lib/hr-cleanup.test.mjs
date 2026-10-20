import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canRemoveHrOriginal } from './hr-cleanup.ts';

describe('HR original deletion boundaries', () => {
  it('removes an original with zero remaining HR and tender references', () => {
    assert.equal(canRemoveHrOriginal({ count: 0, error: null }, { count: 0, error: null }), true);
  });
  it('retains a file used by another HR document', () => {
    assert.equal(canRemoveHrOriginal({ count: 1, error: null }, { count: 0, error: null }), false);
  });
  it('retains a file used by a tender document', () => {
    assert.equal(canRemoveHrOriginal({ count: 0, error: null }, { count: 1, error: null }), false);
  });
  it('does not treat an unknown reference count as zero', () => {
    assert.equal(canRemoveHrOriginal({ count: null, error: null }, { count: 0, error: null }), false);
  });
  it('retains originals when checking references fails', () => {
    assert.equal(canRemoveHrOriginal({ count: 0, error: new Error('unavailable') }, { count: 0, error: null }), false);
  });
});