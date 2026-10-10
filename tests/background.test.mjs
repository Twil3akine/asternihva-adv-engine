import test from 'node:test';
import assert from 'node:assert/strict';
import { AdvEngine, DomUi, BackgroundPresenter } from '../dist/index.js';

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

class Element {
  children = []; parent; style = { setProperty(key, value) { this[key] = value; } };
  append(child) { child.remove(); child.parent = this; this.children.push(child); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = undefined; }
  setAttribute() {}
}
function setup(t, options = {}) {
  const previous = globalThis.document, previousMatch = globalThis.matchMedia;
  const loads = [], animations = [], pending = new Map();
  globalThis.matchMedia = () => ({ matches: options.reduced ?? false });
  globalThis.document = { createElement() {
    const image = new Element();
    image.decode = () => {
      loads.push(image.src);
      if (image.src === 'broken') return Promise.reject(Error('broken'));
      if (image.src === 'pending') return new Promise(resolve => pending.set(image.src, resolve));
      return Promise.resolve();
    };
    image.animate = (frames, timing) => {
      let finish; const finished = new Promise(resolve => { finish = resolve; });
      const animation = { finished, finish, cancel: finish, frames, timing };
      animations.push(animation); return animation;
    };
    return image;
  } };
  t.after(() => { globalThis.document = previous; globalThis.matchMedia = previousMatch; });
  return { loads, animations, pending, host: new Element() };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('initial background decodes only its image and applies anchors and overlay', async t => {
  const h = setup(t), presenter = new BackgroundPresenter(h.host);
  await presenter.set({ src: 'first', anchorX: .3, anchorY: .4, overlay: .2 });
  assert.deepEqual(h.loads, ['first']);
  assert.equal(h.host.children[0].style.objectPosition, '30% 40%');
  assert.equal(h.host.style['--adv-background-overlay'], '0.2');
  assert.equal(h.animations.length, 0);
});
test('background transitions begin after decode and keep the previous image', async t => {
  const h = setup(t), presenter = new BackgroundPresenter(h.host, { transitionDuration: 350 });
  await presenter.set({ src: 'first' });
  const change = presenter.set({ src: 'pending' });
  assert.equal(h.host.children.length, 1);
  assert.equal(h.animations.length, 0);
  h.pending.get('pending')(); await tick();
  assert.equal(h.host.children.length, 2);
  assert.equal(h.animations[0].timing.duration, 350);
  h.animations.forEach(animation => animation.finish()); await change;
  assert.deepEqual(h.host.children.map(image => image.src), ['pending']);
});
test('same background updates framing without loading or animation; failure keeps it', async t => {
  const h = setup(t), presenter = new BackgroundPresenter(h.host);
  await presenter.set({ src: 'first' });
  await presenter.set({ src: 'first', anchorY: .7 });
  await presenter.set({ src: 'broken' });
  assert.deepEqual(h.loads, ['first', 'broken']);
  assert.equal(h.host.children[0].src, 'first');
  assert.equal(h.host.children[0].style.objectPosition, '50% 70%');
  assert.equal(h.animations.length, 0);
});
test('zero duration and reduced motion disable background crossfade', async t => {
  const h = setup(t, { reduced: true });
  for (const options of [{ transitionDuration: 0 }, {}]) {
    const presenter = new BackgroundPresenter(h.host, options);
    await presenter.set({ src: 'first' }); await presenter.set({ src: 'next' }); presenter.destroy();
  }
  assert.equal(h.animations.length, 0);
});
test('rapid background requests ignore stale decode and clear removes pending images', async t => {
  const h = setup(t), presenter = new BackgroundPresenter(h.host, { transitionDuration: 0 });
  await presenter.set({ src: 'first' });
  const pending = presenter.set({ src: 'pending' });
  await presenter.set({ src: 'next' });
  h.pending.get('pending')(); await pending;
  assert.deepEqual(h.host.children.map(image => image.src), ['next']);
  await presenter.set(); assert.equal(h.host.children.length, 0);
});
test('prefetched background decodes once and does not change the stage', async t => {
  const h = setup(t), presenter = new BackgroundPresenter(h.host, { transitionDuration: 0 });
  await presenter.set({ src: 'first' }); await presenter.prefetch({ src: 'next' });
  assert.equal(h.host.children[0].src, 'first');
  await presenter.set({ src: 'next' });
  assert.deepEqual(h.loads, ['first', 'next']);
});
