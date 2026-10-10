import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAutoDelay, defaultAutoConfig } from '../dist/index.js';

test('AUTO waits longer for long visible pages and counts graphemes', () => {
  assert.ok(calculateAutoDelay('うん。') < calculateAutoDelay('長さの違うテキストを比較します。'.repeat(3)));
  const config = { baseDelayMs: 0, perCharacterMs: 10, punctuationDelayMs: 0, minDelayMs: 0 };
  assert.equal(calculateAutoDelay('か\u3099👨‍👩‍👧‍👦', config), 20);
});
test('AUTO uses current page text rather than the whole paginated line', () => {
  const pages = ['うん。', 'その光は、まだ窓の向こうにある。'.repeat(5)];
  assert.ok(calculateAutoDelay(pages[0]) < calculateAutoDelay(pages.join('')));
  assert.ok(calculateAutoDelay(pages[0]) < calculateAutoDelay(pages[1]));
});
test('punctuation, ellipsis groups and line breaks add pauses', () => {
  const config = { baseDelayMs: 0, perCharacterMs: 0, punctuationDelayMs: 100, minDelayMs: 0 };
  assert.equal(calculateAutoDelay('はい。！？……\r\n次', config), 500);
  assert.equal(calculateAutoDelay('はい', config), 0);
});
test('empty text and extreme lengths respect bounds; caller minimum is independent', () => {
  assert.equal(calculateAutoDelay(''), defaultAutoConfig.minDelayMs);
  assert.equal(calculateAutoDelay('星'.repeat(10000)), defaultAutoConfig.maxDelayMs);
  assert.equal(calculateAutoDelay('うん。', {}, 20000), 20000);
});
test('invalid AUTO config is rejected without accepting inverted or negative delays', () => {
  for (const config of [{ perCharacterMs: -1 }, { minDelayMs: 20000 }, { maxDelayMs: Infinity }]) {
    assert.throws(() => calculateAutoDelay('text', config), /AUTO delays/);
  }
});
