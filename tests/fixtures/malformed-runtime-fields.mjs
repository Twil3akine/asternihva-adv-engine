// Ordinary JS module fixtures: no TypeScript casts or game-specific data.
const scalarFailures = [undefined, null, [], 'hello', { value: {} }, { value: [] }, { value: undefined }, { value: NaN }, { value: Infinity }, { value: () => 1 }];
export const malformedValues = scalarFailures;
export const malformedOptionalSets = scalarFailures.filter(value => value !== undefined);
export const malformedPositions = [null, 'off-stage', 10, [], {}, { x: '50' }, { x: NaN }, { x: Infinity }, { x: 50, y: null }, { x: 50, scale: Infinity }, { x: 50, zIndex: '1' }];
export const malformedAudioNodes = [
  ...[undefined, null, '', 'music', 1].map(channel => ({ type: 'audio', channel })),
  ...[null, '', ' ', 1, {}].map(id => ({ type: 'audio', channel: 'bgm', id })),
  ...['yes', 1, null].map(loop => ({ type: 'audio', channel: 'bgm', id: 'track', loop })),
  ...[-1, 2, NaN, Infinity, '1', null].map(volume => ({ type: 'audio', channel: 'bgm', id: 'track', volume })),
  ...['fadeInMs', 'fadeOutMs', 'crossfadeMs'].flatMap(key => [-1, NaN, Infinity, '100', null].map(value => ({ type: 'audio', channel: 'bgm', id: 'track', [key]: value }))),
];
