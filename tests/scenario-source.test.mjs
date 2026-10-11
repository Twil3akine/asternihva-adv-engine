import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { lintScenarioSource } from '../dist/tooling/index.js';

 test('source lint detects duplicate keys before JavaScript overwrites them', async () => {
  const result = await lintScenarioSource("export const game = {scenes:{ intro:[], 'intro':[] }};");
  assert.equal(result.valid, false); assert.equal(result.errors, 1);
  assert.equal(result.tables, 1); assert.equal(result.scenes, 1);
  assert.equal(result.diagnostics[0].code, 'duplicate-scene');
  assert.equal(result.diagnostics[0].line, 1);
  assert.deepEqual(Object.keys(result.diagnostics[0]), ['severity', 'code', 'line', 'column']);
});

test('source lint normalizes quoted escaped numeric and static computed keys', async () => {
  const result = await lintScenarioSource("const game = {scenes:{ intro:[], ['intro']:[], 'in\\u0074ro':[], 1:[], '1':[], [`intro`]:[] }};");
  assert.equal(result.errors, 4); assert.equal(result.scenes, 2);
});

test('source lint treats different tables independently and ignores fake keys in strings and comments', async () => {
  const result = await lintScenarioSource("/* scenes: {intro:[], intro:[]} */ const text = 'scenes: {intro:[], intro:[]}'; export const a={scenes:{intro:[]}}, b={scenes:{intro:[]}};");
  assert.equal(result.valid, true); assert.equal(result.errors, 0); assert.equal(result.warnings, 0);
  assert.equal(result.tables, 2); assert.equal(result.scenes, 2);
});

test('source lint reports incomplete static coverage for spreads and dynamic keys', async () => {
  const result = await lintScenarioSource('const a={scenes:{intro:[], ...other, [key]:[]}}, b={scenes: build()}, c={scenes};');
  assert.equal(result.valid, true);
  assert.deepEqual(result.diagnostics.map(d => d.code), ['spread-scenes', 'dynamic-scene-id', 'dynamic-scenes', 'dynamic-scenes']);
});

test('source lint reports syntax locations without revealing identifiers or text', async () => {
  const source = "export const game={scenes:{intro:[{text:'hidden fixture text'}]";
  const result = await lintScenarioSource(source);
  assert.equal(result.valid, false); assert(result.errors > 0);
  assert(result.diagnostics.every(d => d.code === 'syntax'));
  assert(!JSON.stringify(result).includes('hidden fixture text'));
  assert(!JSON.stringify(result).includes('intro'));
});

test('source lint warns when no scenes table is present and accepts empty inline tables', async () => {
  assert.equal((await lintScenarioSource('export const answer=1;')).diagnostics[0].code, 'no-scenes');
  assert.equal((await lintScenarioSource('export const game={scenes:({})};')).warnings, 0);
  await assert.rejects(lintScenarioSource(null), TypeError);
});

test('source lint positions the duplicate key on its actual source line', async () => {
  const result = await lintScenarioSource('export const game = {scenes: {\n intro: [],\n intro: []\n}};');
  assert.deepEqual(result.diagnostics[0], { severity: 'error', code: 'duplicate-scene', line: 3, column: 2 });
});

test('CLI source lint does not evaluate modules and exits nonzero for duplicate scenes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'adv-source-'));
  try {
    const path = join(directory, 'sample.mjs');
    await writeFile(path, "throw new Error('module must not run'); export const game={scenes:{'scene-a':[]}};");
    let result = spawnSync(process.execPath, ['scripts/cli.mjs', 'scenario', 'lint-source', path], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).valid, true);
    await writeFile(path, "export const game={scenes:{'scene-a':[{text:'hidden fixture text'}], 'scene-a':[]}};");
    result = spawnSync(process.execPath, ['scripts/cli.mjs', 'scenario', 'lint-source', path], { encoding: 'utf8' });
    assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).errors, 1);
    assert(!result.stdout.includes('hidden fixture text')); assert(!result.stdout.includes('scene-a'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
