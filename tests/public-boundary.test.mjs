import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { scanPublicText } from '../scripts/public-boundary.mjs';
test('boundary fingerprint rejects a reserved token even inside a filename', () => {
  const rules = [{ length: 9, sha256: createHash('sha256').update('forbidden').digest('hex') }];
  assert.equal(scanPublicText('assets/FORBIDDEN-smile.svg',rules), 'reserved-work-detail');
  assert.equal(scanPublicText('assets/alice-smile.svg',rules), undefined);
});
test('package and repository identity and generic fixtures are permitted', () => {
  assert.equal(scanPublicText('asternihva-adv-engine/core Alice Bob hello scene-a'), undefined);
});
