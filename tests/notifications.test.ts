import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNudgeDue, localClock } from '../src/lib/notifications.ts';
test('19:30 Baku nudge is due at 15:30 UTC, once per quarter-hour window', () => {
  assert.equal(isNudgeDue(new Date('2026-10-09T15:30:00Z'),'Asia/Baku','19:30').due,true);
  assert.equal(isNudgeDue(new Date('2026-10-09T15:29:00Z'),'Asia/Baku','19:30').due,false);
  assert.equal(isNudgeDue(new Date('2026-10-09T15:45:00Z'),'Asia/Baku','19:30').due,false);
});
test('local dates and daylight saving time are respected', () => {
  assert.equal(localClock(new Date('2026-10-09T21:00:00Z'),'Asia/Baku').date,'2026-10-10');
  assert.equal(isNudgeDue(new Date('2026-07-09T23:30:00Z'),'America/New_York','19:30').due,true);
  assert.equal(isNudgeDue(new Date('2026-12-10T00:30:00Z'),'America/New_York','19:30').due,true);
});
