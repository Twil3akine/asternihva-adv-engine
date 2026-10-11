import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateScenarios } from '../dist/tooling/index.js';
import { validateSaveState } from '../dist/core.js';
import { malformedValues, malformedOptionalSets, malformedPositions, malformedAudioNodes } from './fixtures/malformed-runtime-fields.mjs';

function fixture(nodes, overrides = {}) {
  return { id: 'sample', title: 'Sample', entry: { start: 'scene-a', characters: [{ id: 'alice', name: 'Alice', renderer: 'mock' }], audioAssets: { track: 'track.ogg' }, scenes: { 'scene-a': nodes, 'scene-b': [{type:'end'}] }, ...overrides } };
}
function rejects(item, location, message) {
  for (const lint of [false, true]) {
    const result = validateScenarios([item], { lint });
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.some(d => d.severity === 'error' && d.location === location && d.message.includes(message)), JSON.stringify(result.diagnostics));
  }
}
test('JS set.values fixtures must be finite scalar records', () => {
  for (const values of malformedValues) rejects(fixture([{type:'set',values}]), 'scene-a[0].values', 'set.values');
});
test('JS choice option set fixtures must be finite scalar records', () => {
  for (const set of malformedOptionalSets) rejects(fixture([{type:'choice',options:[{text:'Go',next:'scene-b',set}]}]), 'scene-a[0].options[0].set', 'choice set');
});
test('JS initial variables follow the same scalar contract as saved variables', () => {
  for (const initialState of malformedOptionalSets) rejects(fixture([{type:'end'}], {initialState}), 'initialState', 'finite scalar');
});
test('JS audio nodes reject invalid channels, IDs and every public audio option', () => {
  for (const node of malformedAudioNodes) {
    const result = validateScenarios([fixture([node])]);
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.some(d => d.severity === 'error' && /invalid audio|audio id/.test(d.message)));
  }
});
test('JS stage positions reject malformed line, command and layout positions', () => {
  for (const position of malformedPositions) {
    rejects(fixture([{type:'line',speaker:'alice',text:'hello',position}]), 'scene-a[0].position', 'invalid stage position');
    rejects(fixture([{type:'scene',commands:[{character:'alice',position}]}]), 'scene-a[0].commands[0].position', 'invalid stage position');
    rejects(fixture([{type:'end'}], {stageLayouts:{solo:{members:[{character:'alice',position}]}}}), 'stageLayouts.solo.members[0].position', 'invalid stage position');
  }
});
test('JS optional prompt/voice and command/layout fields enforce their public types', () => {
  rejects(fixture([{type:'choice',prompt:1,options:[{text:'Go',next:'scene-b'}]}]), 'scene-a[0].prompt', 'expected string');
  rejects(fixture([{type:'line',text:'hello',voice:5}]), 'scene-a[0].voice', 'voice id');
  for(const [key,value] of [['show','yes'],['expression',false],['motion',5]]) rejects(fixture([{type:'scene',commands:[{character:'alice',[key]:value}]}]), `scene-a[0].commands[0].${key}`, 'expected');
  rejects(fixture([{type:'end'}], {stageLayouts:{solo:{hideOthers:1,members:[]}}}), 'stageLayouts.solo.hideOthers', 'expected boolean');
  rejects(fixture([{type:'end'}], {stageLayouts:{solo:{members:[{character:'alice',show:'yes'}]}}}), 'stageLayouts.solo.members[0].show', 'expected boolean');
});
test('valid scalar values, numeric positions and audio boundaries remain compatible', () => {
  const values = { text:'hello', count:0, enabled:false, empty:null }, position = { x:50, y:0, scale:1, zIndex:0 };
  const item = fixture([
    {type:'set',values},
    {type:'line',text:'hello',speaker:'alice',position,voice:'track'},
    {type:'audio',channel:'bgm',id:'track',loop:false,volume:0,fadeInMs:0,crossfadeMs:0},
    {type:'audio',channel:'se',id:'track',volume:1},
    {type:'audio',channel:'voice',fadeOutMs:0},
    {type:'choice',options:[{text:'Go',next:'scene-b',set:values}]},
  ], {initialState:values,stageLayouts:{solo:{hideOthers:false,members:[{character:'alice',position,show:true}]}}});
  assert.equal(validateScenarios([item]).valid, true);
  assert.doesNotThrow(() => validateSaveState({version:1,scenarioId:'sample',ended:false,runtime:{sceneId:'scene-a',nodeIndex:0,state:values},presentation:{characters:[{character:'alice',visible:true,position}]}}));
});
