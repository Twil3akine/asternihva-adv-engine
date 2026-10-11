import { createStageLayoutPreset } from '../../dist/core.js';
const asset = name => new URL(`./assets/${name}`, import.meta.url).href;
export const characters = [
  { id: 'alice', name: 'Alice', renderer: 'sprite', defaultExpression: 'normal', assets: { expressions: { normal: asset('alice-normal.svg'), smile: asset('alice-smile.svg') }, displayMode: 'contain' } },
  { id: 'bob', name: 'Bob', renderer: 'sprite', defaultExpression: 'normal', assets: { expressions: { normal: asset('bob-normal.svg') }, displayMode: 'contain' } },
];
export const backgrounds = { 'sample-room': { src: asset('sample-room.svg') } };
export const layouts = { duo: createStageLayoutPreset('duo-left', ['alice', 'bob']) };
// New sample written independently of any game project.
export const scenarios = ['sample-a', 'sample-b'].map((id, index) => ({
  scenario: { id, chapter: `CH.${index + 1}`, title: `Sample ${index + 1}`, order: index },
  start: 'scene-a', characters, backgrounds, stageLayouts: layouts,
  scenes: {
    'scene-a': [
      { type: 'scene', background: 'sample-room', layout: 'duo' },
      { type: 'line', speaker: 'alice', text: 'Hello.' },
      { type: 'line', speaker: 'bob', text: 'This is a sample.' },
      { type: 'choice', options: [
        { text: 'Continue', next: 'scene-b', set: { route: 'a' } },
        { text: 'Finish', next: 'scene-b', set: { route: 'b' } },
      ] },
    ],
    'scene-b': [{ type: 'line', speaker: 'alice', expression: 'smile', text: 'Done.' }, { type: 'end' }],
  },
}));
