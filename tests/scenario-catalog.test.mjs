import test from 'node:test';
import assert from 'node:assert/strict';
import { ScenarioCatalog, AdvEngine } from '../dist/index.js';
const game = { start: 'start', characters: [], scenario: { title: 'Original', chapter: 'ONE' }, scenes: { start: [{ type: 'end' }] } };
const options = () => ({ stage: { setActive() {}, destroy() {} }, ui: { setScenarioMetadata(value) { this.metadata = value; }, presentEnd() {} } });
test('scenario catalog preserves order and reuses metadata with optional descriptions', () => {
  const catalog = new ScenarioCatalog([{ id: 'b', entry: game }, { id: 'a', title: 'Override', description: 'About', entry: game }]);
  assert.deepEqual(catalog.getScenarios().map(item => item.id), ['b', 'a']);
  assert.equal(catalog.getScenarioMetadata('b').title, 'Original');
  assert.equal(catalog.getScenarioMetadata('a').description, 'About');
  assert.equal(catalog.getScenarioMetadata('missing'), undefined);
});
test('scenario catalog starts the selected scenario and reports completion without mutating its definition', async () => {
  const catalog = new ScenarioCatalog([{ id: 'story', title: 'Selected', entry: game }]);
  const presentation = options();
  const { engine, finished } = catalog.startScenario('story', presentation);
  assert(engine instanceof AdvEngine);
  await finished;
  assert.equal(engine.ended, true);
  assert.equal(presentation.ui.metadata.title, 'Selected');
  assert.equal(game.scenario.title, 'Original');
  const replay = catalog.startScenario('story', options());
  assert.notEqual(replay.engine, engine);
  await replay.finished;
});
test('invalid scenario ids fail before starting or touching presentation', () => {
  assert.throws(() => new ScenarioCatalog([{ id: 'a', entry: game }, { id: 'a', entry: game }]), /duplicate/);
  assert.throws(() => new ScenarioCatalog([{ id: ' ', entry: game }]), /Invalid/);
  assert.throws(() => new ScenarioCatalog().startScenario('missing', options()), /Unknown scenario/);
});
test('catalog is optional and direct engine execution remains supported', async () => {
  assert.deepEqual(new ScenarioCatalog().getScenarios(), []);
  const engine = new AdvEngine({ game, ...options() });
  await engine.run();
  assert.equal(engine.ended, true);
});
