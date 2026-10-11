import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scenarios, characters } from '../examples/generic/scenario.mjs';
import { validateScenarios, lintScenarioSource } from '../dist/tooling/index.js';
test('both generic chapters validate using their own sprite and background registries', () => {
  const result = validateScenarios(scenarios.map(entry => ({ ...entry.scenario, entry })));
  assert.equal(result.errors, 0); assert.equal(result.warnings, 0);
  assert.deepEqual(characters.map(c => c.name), ['Alice','Bob']);
  assert(scenarios.every(s => Object.values(s.scenes).flat().some(n => n.type === 'choice')));
});
test('sample source has static scene IDs and no duplicate keys', async () => {
  const result = await lintScenarioSource(await readFile(new URL('../examples/generic/scenario.mjs',import.meta.url),'utf8'));
  assert.equal(result.errors, 0); assert.equal(result.warnings, 0);
});
test('sample sprites are independently authored geometric SVGs', async () => {
  for (const name of ['alice-normal','alice-smile','bob-normal']) {
    const text = await readFile(new URL(`../examples/generic/assets/${name}.svg`,import.meta.url),'utf8');
    assert.match(text, /<svg/); assert.match(text, /<(circle|rect|path)/); assert.doesNotMatch(text, /<image|href=/);
  }
});
