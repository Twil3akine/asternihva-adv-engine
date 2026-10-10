import test from 'node:test';
import assert from 'node:assert/strict';
import { AdvEngine, DomUi } from '../dist/index.js';

test('named backgrounds resolve game definitions while legacy paths and adapters stay supported', async () => {
  const definition = { src: '/room.png', anchorX: .3, anchorY: .4, overlay: .2 };
  const game = { start: 'intro', characters: [], backgrounds: { room: definition }, scenes: { intro: [
    { type: 'scene', background: 'room' }, { type: 'scene', background: '/other.png' }, { type: 'end' },
  ] } };
  const received = [];
  const ui = { presentBackground(value) { received.push(value); }, presentEnd() {} };
  await new AdvEngine({ game, ui, stage: { setActive() {} } }).run();
  assert.deepEqual(received, [definition, { src: '/other.png' }]);
  const legacy = [];
  await new AdvEngine({ game, ui: { setBackground(src) { legacy.push(src); }, presentEnd() {} }, stage: { setActive() {} } }).run();
  assert.deepEqual(legacy, ['/room.png', '/other.png']);
});
test('background cover, independent anchors and overlay use game-supplied values', () => {
  const properties = {};
  const style = { setProperty(key, value) { properties[key] = value; } };
  const ui = new DomUi({ background: { style } });
  ui.presentBackground({ src: '/room.png', anchorX: .3, anchorY: .4, overlay: .2 });
  assert.equal(style.backgroundSize, 'cover');
  assert.equal(style.backgroundPosition, '30% 40%');
  assert.equal(properties['--adv-background-overlay'], '0.2');
  ui.setBackground();
  assert.equal(style.backgroundImage, '');
});
