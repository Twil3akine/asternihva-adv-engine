import type { GameDefinition } from 'asternihva-adv-engine/core';
import type { SpriteAssets } from 'asternihva-adv-engine/web';
export const chapter1: GameDefinition = {
  title: 'Independent game', scenario: { id: 'chapter1', chapter: 'Chapter 1', title: 'Sample' },
  start: 'scene-a', initialState: { route: '' },
  characters: [
    { id: 'alice', name: 'Alice', renderer: 'sprite', defaultExpression: 'normal', assets: { expressions: { normal: '/alice.svg', smile: '/alice-smile.svg' }, displayMode: 'fullbody' } satisfies SpriteAssets },
    { id: 'bob', name: 'Bob', renderer: 'sprite', defaultExpression: 'normal', assets: { expressions: { normal: '/bob.svg' }, displayMode: 'fullbody' } satisfies SpriteAssets },
  ], backgrounds: { room: { src: '/room.svg' } },
  scenes: {
    'scene-a': [
      { type: 'scene', background: 'room', commands: [{ character: 'alice', show: true, position: 'left' }, { character: 'bob', show: true, position: 'right' }] },
      { type: 'line', speaker: 'alice', text: 'Hello from a separate project.' },
      { type: 'choice', options: [{ text: 'A', next: 'scene-b', set: { route: 'a' } }, { text: 'B', next: 'scene-b', set: { route: 'b' } }] },
    ],
    'scene-b': [{ type: 'line', speaker: 'alice', expression: 'smile', text: 'Thank you.' }, { type: 'line', speaker: 'bob', text: 'Done.' }, { type: 'end' }],
  },
};
