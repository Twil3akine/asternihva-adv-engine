import test from 'node:test';
import assert from 'node:assert/strict';
import { initialBackground, backgroundManifest } from '../examples/asternihva/background-manifest.mjs';
test('demo checks only the first background and uses a gradient when local art is absent', async () => {
  const requests = [];
  assert.equal(await initialBackground(async (src, options) => { requests.push([src, options]); return { ok: true }; }), 'room-night');
  assert.deepEqual(requests, [[backgroundManifest['room-night'].src, { method: 'HEAD' }]]);
  assert.equal(await initialBackground(async () => ({ ok: false })), undefined);
  assert.equal(await initialBackground(async () => { throw Error('offline'); }), undefined);
});
