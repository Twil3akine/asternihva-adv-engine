import test from 'node:test';
import assert from 'node:assert/strict';
import { AdvEngine, CharacterStage } from '../dist/index.js';

test('dialogue carries logical expression state from defaults, scene commands and previous lines', async () => {
  const characters = ['a', 'b'].map(id => ({ id, name: id.toUpperCase(), renderer: 'custom', defaultExpression: 'neutral' }));
  const renderer = { key: 'custom', create() { return { show() {}, hide() {}, setExpression() {}, playMotion() {}, setPosition() {}, destroy() {} }; } };
  const stage = new CharacterStage({}, characters, [renderer]);
  const lines = [];
  const ui = { async presentLine(line) { lines.push(line); }, presentEnd() {} };
  const game = { start: 'intro', characters, scenes: { intro: [
    { type: 'line', speaker: 'a', text: 'default' },
    { type: 'scene', commands: [{ character: 'a', expression: 'smile' }] },
    { type: 'line', speaker: 'a', text: 'inherited' },
    { type: 'line', speaker: 'b', text: 'independent', expression: 'angry' },
    { type: 'line', speaker: 'a', text: 'still smiling' },
    { type: 'line', text: 'narration' },
    { type: 'end' },
  ] } };
  await new AdvEngine({ game, stage, ui }).run();
  assert.deepEqual(lines.map(line => line.expression), ['neutral', 'smile', 'angry', 'smile', undefined]);
  assert.equal(stage.getExpression('missing'), undefined);
  assert.deepEqual(Object.keys(lines[1]).sort(), ['expression', 'speakerId', 'speakerName', 'text']);
});

test('failed renderer expression commands do not replace the previous logical expression', async () => {
  const renderer = { key: 'custom', create() { return { setExpression() { throw new Error('failed'); }, destroy() {} }; } };
  const stage = new CharacterStage({}, [{ id: 'a', name: 'A', renderer: 'custom', defaultExpression: 'neutral' }], [renderer]);
  await assert.rejects(stage.command({ character: 'a', expression: 'smile' }), /failed/);
  assert.equal(stage.getExpression('a'), 'neutral');
});
