import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkRelease } from '../templates/consumer/release-check.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'adv-release-'));
  t.after(() => rm(dir, {recursive:true,force:true}));
  await writeFile(join(dir, 'index.html'), '<!doctype html><title>Sample</title>');
  return dir;
}
test('production output accepts optimized assets and static headers', async t => {
  const dir = await fixture(t);
  await writeFile(join(dir,'main.js'), 'console.log("hello")');
  await writeFile(join(dir,'_headers'), '/*\n  Cache-Control: no-cache');
  assert.deepEqual(await checkRelease(dir), {valid:true,files:3,errors:[]});
});
test('production output rejects maps, inline map references and hidden source', async t => {
  const dir = await fixture(t);
  await writeFile(join(dir,'main.js'), '//# sourceMappingURL=data:application/json;base64,e30=');
  await writeFile(join(dir,'main.js.map'), '{}');
  await mkdir(join(dir,'.source')); await writeFile(join(dir,'.source','secret.ts'), '');
  const result = await checkRelease(dir);
  assert.equal(result.valid, false); assert.equal(result.errors.length,3);
});
test('production output rejects symlink traversal', async t => {
  const dir = await fixture(t); await symlink(tmpdir(),join(dir,'external'));
  assert.deepEqual((await checkRelease(dir)).errors,['external: symlink']);
});
test('production output checks missing shell, file count and individual size', async t => {
  const dir = await fixture(t);
  await writeFile(join(dir,'audio.ogg'), '1234567890');
  const result = await checkRelease(dir,{maxBytes:8,maxFiles:1});
  assert.equal(result.errors.length,3);
  await rm(join(dir,'index.html'));
  assert.ok((await checkRelease(dir)).errors.includes('index.html: missing'));
  await assert.rejects(checkRelease(dir,{maxBytes:NaN}),TypeError);
});
test('Wrangler template has no worker entry and no public preview by default', async () => {
  const config = JSON.parse(await readFile(new URL('../templates/consumer/wrangler.jsonc.example',import.meta.url),'utf8'));
  assert.equal(config.assets.directory,'./dist'); assert.equal(config.main,undefined);
  assert.equal(config.workers_dev,false); assert.equal(config.preview_urls,false);
  assert.deepEqual(config.routes,[{pattern:'game.example.org',custom_domain:true}]);
});
