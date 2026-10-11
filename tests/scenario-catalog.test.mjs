import test from 'node:test';
import assert from 'node:assert/strict';
import { ScenarioCatalog, AdvEngine, CharacterStage, SaveStore } from '../dist/index.js';
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

test('catalog looks up three definitions, sorts by order, and tracks the current scenario', async () => {
  const entries = [2, 0, 1].map(order => ({ id: `s${order}`, entry: { ...game, scenario: { id: `s${order}`, chapter: `CH.${order}`, title: 'Test scene', order } } }));
  const catalog = new ScenarioCatalog(entries);
  assert.deepEqual(catalog.getScenarios().map(item => item.id), ['s0', 's1', 's2']);
  assert.equal(catalog.getCurrentScenario(), undefined);
  assert.equal(catalog.getScenario('s1').entry, entries[2].entry);
  assert.equal(catalog.getScenario('invalid'), undefined);
  await catalog.startScenario('s1', options()).finished;
  assert.equal(catalog.getCurrentScenario().id, 's1');
  assert.throws(() => catalog.startScenario('invalid', options()), /Unknown scenario/);
  assert.equal(catalog.getCurrentScenario().id, 's1');
});

test('catalog creates a selected engine without running nodes and preserves catalog metadata', async () => {
  const catalog = new ScenarioCatalog([{ id: 'sample', title: 'Override', entry: game }]);
  const presentation = options();
  let ended = false; presentation.ui.presentEnd = () => { ended = true; };
  const engine = catalog.createScenario('sample', presentation);
  assert.equal(catalog.getCurrentScenario().id, 'sample');
  assert.equal(ended, false);
  assert.equal(presentation.ui.metadata.title, 'Override');
  assert.throws(() => catalog.createScenario('missing', presentation), /Unknown scenario/);
  assert.equal(catalog.getCurrentScenario().id, 'sample');
  await engine.run(); assert.equal(ended, true);
  engine.destroy();
});

for (const overrides of [false, true]) test(`all catalog paths preserve complete ${overrides ? 'overridden' : 'fallback'} metadata`, async () => {
  const source = { ...game, scenario: { id: 'source-id', chapter: 'ONE', title: 'Original', description: 'Original description', order: 10 } };
  const expected = overrides
    ? { id: 'sample', chapter: 'TWO', title: 'Selected', description: '', order: 0 }
    : { ...source.scenario, id: 'sample' };
  const catalog = new ScenarioCatalog([{ id: 'sample', ...(overrides ? expected : {}), entry: source }]);
  const data = new Map(), saves = new SaveStore({ getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,value), removeItem: key => data.delete(key) }, 'sample');
  const make = () => ({ saves, stage: new CharacterStage({}, [], []), ui: { setScenarioMetadata(value) { this.metadata = value; }, presentEnd() {} } });
  const creation = make(), created = catalog.createScenario('sample', creation);
  assert.deepEqual(creation.ui.metadata, expected);
  await created.save('manual-1'); created.destroy();
  const starting = make(), started = catalog.startScenario('sample', starting);
  await started.finished; assert.deepEqual(starting.ui.metadata, expected); started.engine.destroy();
  const loading = make(), loaded = await catalog.loadScenario('manual-1', loading);
  await loaded.finished; assert.deepEqual(loading.ui.metadata, expected); loaded.engine.destroy();
  assert.deepEqual(catalog.getScenarioMetadata('sample'), expected);
  assert.deepEqual(source.scenario, { id: 'source-id', chapter: 'ONE', title: 'Original', description: 'Original description', order: 10 });
});
