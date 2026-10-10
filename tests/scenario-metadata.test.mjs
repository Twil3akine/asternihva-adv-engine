import test from 'node:test';
import assert from 'node:assert/strict';
import { AdvEngine, DomUi } from '../dist/index.js';

test('engine passes optional scenario metadata unchanged to its adapter', () => {
  const scenario = { id: 'episode', chapter: 'EP.01', title: 'A light' };
  let received;
  new AdvEngine({ game: { scenario, start: 'intro', characters: [], scenes: {} }, stage: {}, ui: { setScenarioMetadata(value) { received = value; } } });
  assert.equal(received, scenario);
});
test('scenario title supports chapter, title only, chapter only and absent metadata', () => {
  const scenarioTitle = { textContent: '', hidden: false };
  const ui = new DomUi({ scenarioTitle });
  ui.setScenarioMetadata({ chapter: 'EP.01', title: 'A light' });
  assert.equal(scenarioTitle.textContent, 'EP.01\nA light');
  ui.setScenarioMetadata({ title: 'A light' });
  assert.equal(scenarioTitle.textContent, 'A light');
  ui.setScenarioMetadata({ chapter: 'EP.01' });
  assert.equal(scenarioTitle.textContent, 'EP.01');
  ui.setScenarioMetadata();
  assert.equal(scenarioTitle.hidden, true);
  assert.equal(scenarioTitle.textContent, '');
  new DomUi({}).setScenarioMetadata({ title: 'Optional element' });
});
