import test from "node:test";
import assert from "node:assert/strict";
import { SpriteRenderer } from "../dist/index.js";

class Style {
  properties = new Map();
  setProperty(name, value) { this.properties.set(name, value); }
  getPropertyValue(name) { return this.properties.get(name) ?? ""; }
  removeProperty(name) { this.properties.delete(name); }
}

class Element {
  dataset = {};
  style = new Style();
  children = [];
  parentElement;

  append(child) {
    child.remove();
    child.parentElement = this;
    this.children.push(child);
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = undefined;
  }

  setAttribute(name, value) { this[name] = value; }
}

class FakeAnimation {
  #resolve;
  #reject;
  finished = new Promise((resolve, reject) => {
    this.#resolve = resolve;
    this.#reject = reject;
  });
  canceled = false;

  finish() { this.#resolve(); }
  cancel() {
    if (this.canceled) return;
    this.canceled = true;
    this.#reject(new Error("Animation canceled"));
  }
}

class ImageElement extends Element {
  writes = [];
  animations = [];
  #harness;

  constructor(harness) {
    super();
    this.#harness = harness;
    if (!harness.animate) this.animate = undefined;
  }

  set src(value) { this.writes.push(value); this.source = value; }
  get src() { return this.source; }

  decode() {
    if (this.source === "broken.svg") return Promise.reject(new Error("load failed"));
    if (!this.#harness.deferredSources.has(this.source)) return Promise.resolve();
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    this.#harness.pending.set(this.source, { resolve, reject });
    return promise;
  }

  animate(keyframes, timing) {
    const animation = new FakeAnimation();
    this.animations.push({ keyframes, timing, animation });
    this.#harness.animations.push({ target: this, keyframes, timing, animation });
    return animation;
  }
}

function setup(t, { crossfadeDuration, deferredSources = [], animate = true } = {}) {
  const previousDocument = globalThis.document;
  const harness = {
    deferredSources: new Set(deferredSources),
    pending: new Map(),
    animations: [],
    animate,
  };
  globalThis.document = {
    createElement: (tag) => tag === "img" ? new ImageElement(harness) : new Element(),
  };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });

  const host = new Element();
  const renderer = new SpriteRenderer(crossfadeDuration === undefined ? {} : { crossfadeDuration });
  const character = renderer.create(host, {
    id: "a",
    name: "Alice",
    renderer: "sprite",
    assets: { expressions: {
      normal: "normal.svg",
      smile: "smile.svg",
      surprised: "surprised.svg",
      angry: "angry.svg",
      broken: "broken.svg",
    } },
  });
  return { host, character, harness };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function visualOf(host) { return host.children[0].children[0]; }
function imageOf(host) { return visualOf(host).children[0]; }

test("expression crossfade starts after decode and keeps the persistent image", async (t) => {
  const { host, character, harness } = setup(t, { deferredSources: ["smile.svg"] });
  await character.show();

  const visual = visualOf(host);
  const image = imageOf(host);
  assert.equal(visual.children.length, 1);
  assert.equal(image.src, "normal.svg");

  let settled = false;
  const changing = character.setExpression("smile").then(() => { settled = true; });
  await flush();
  assert.equal(image.src, "normal.svg");
  assert.equal(harness.animations.length, 0);
  assert.equal(settled, false);

  harness.pending.get("smile.svg").resolve();
  await flush();
  assert.equal(image.src, "smile.svg");
  assert.equal(visual.children.length, 2);
  const ghost = visual.children[1];
  assert.equal(ghost.src, "normal.svg");
  assert.equal(ghost.alt, "");
  assert.equal(ghost["aria-hidden"], "true");
  assert.equal(harness.animations.length, 2);
  assert.deepEqual(harness.animations.map(({ keyframes }) => keyframes), [
    [{ opacity: 0 }, { opacity: 1 }],
    [{ opacity: 1 }, { opacity: 0 }],
  ]);
  assert.deepEqual(harness.animations.map(({ timing }) => timing.duration), [180, 180]);
  assert.deepEqual(harness.animations.map(({ timing }) => timing.fill), ["both", "both"]);
  assert.equal(settled, false);

  harness.animations.forEach(({ animation }) => animation.finish());
  await changing;
  assert.equal(settled, true);
  assert.deepEqual(visual.children, [image]);
});

test("identical, unknown, and failed expressions leave the image and fades alone", async (t) => {
  const { host, character, harness } = setup(t);
  await character.show();
  const image = imageOf(host);

  await character.setExpression("normal");
  await character.setExpression("missing");
  await character.setExpression("broken");
  assert.deepEqual(image.writes, ["normal.svg"]);
  assert.deepEqual(visualOf(host).children, [image]);
  assert.equal(harness.animations.length, 0);

  const changing = character.setExpression("smile");
  await flush();
  assert.equal(harness.animations.length, 2);
  harness.animations.forEach(({ animation }) => animation.finish());
  await changing;
  const writes = image.writes.length;
  const animationCount = harness.animations.length;
  await character.setExpression("smile");
  assert.equal(image.writes.length, writes);
  assert.equal(harness.animations.length, animationCount);
});

test("a newer decoded request cancels an active fade and stale loads cannot replace it", async (t) => {
  const { host, character, harness } = setup(t, { deferredSources: ["surprised.svg", "angry.svg"] });
  await character.show();
  const visual = visualOf(host);
  const image = imageOf(host);

  const firstFade = character.setExpression("smile");
  await flush();
  const firstAnimations = harness.animations.slice(0, 2).map(({ animation }) => animation);
  assert.equal(image.src, "smile.svg");

  let staleSettled = false;
  const staleLoad = character.setExpression("surprised").then(() => { staleSettled = true; });
  const newest = character.setExpression("angry");
  assert.equal(image.src, "smile.svg");
  harness.pending.get("angry.svg").resolve();
  await flush();
  assert.equal(image.src, "angry.svg");
  assert.ok(firstAnimations.every((animation) => animation.canceled));
  assert.equal(visual.children.length, 2);
  assert.equal(visual.children[1].src, "smile.svg");
  assert.equal(staleSettled, false);

  const newestAnimations = harness.animations.slice(-2).map(({ animation }) => animation);
  newestAnimations.forEach((animation) => animation.finish());
  await Promise.all([firstFade, newest]);
  harness.pending.get("surprised.svg").resolve();
  await staleLoad;
  assert.equal(image.src, "angry.svg");
  assert.deepEqual(visual.children, [image]);
});

test("zero duration and missing animate support swap immediately", async (t) => {
  const disabled = setup(t, { crossfadeDuration: 0 });
  t.after(() => disabled.character.destroy());
  await disabled.character.show();
  const disabledImage = imageOf(disabled.host);
  await disabled.character.setExpression("smile");
  assert.equal(disabledImage.src, "smile.svg");
  assert.deepEqual(visualOf(disabled.host).children, [disabledImage]);
  assert.equal(disabled.harness.animations.length, 0);

  const unsupported = setup(t, { animate: false });
  t.after(() => unsupported.character.destroy());
  await unsupported.character.show();
  const unsupportedImage = imageOf(unsupported.host);
  await unsupported.character.setExpression("smile");
  assert.equal(unsupportedImage.src, "smile.svg");
  assert.deepEqual(visualOf(unsupported.host).children, [unsupportedImage]);
});

test("destroy cancels the fade, removes its ghost, and ignores later loads", async (t) => {
  const { host, character, harness } = setup(t, { deferredSources: ["angry.svg"] });
  await character.show();
  const visual = visualOf(host);
  const changing = character.setExpression("smile");
  await flush();
  const fadingAnimations = harness.animations.map(({ animation }) => animation);

  let pendingSettled = false;
  const pending = character.setExpression("angry").then(() => { pendingSettled = true; });
  character.destroy();
  await changing;
  assert.ok(fadingAnimations.every((animation) => animation.canceled));
  assert.equal(host.children.length, 0);
  assert.equal(visual.children.length, 1);
  assert.equal(pendingSettled, false);

  harness.pending.get("angry.svg").resolve();
  await pending;
  assert.equal(visual.children[0].src, "smile.svg");
  assert.equal(visual.children.length, 1);
});

test("crossfade duration is configurable and other characters keep their images", async (t) => {
  const { host, character, harness } = setup(t, { crossfadeDuration: 250 });
  const other = new SpriteRenderer().create(host, {
    id: "b", name: "Bob", renderer: "sprite", assets: { expressions: { normal: "normal.svg" } },
  });
  await Promise.all([character.show(), other.show()]);
  const otherImage = host.children[1].children[0].children[0];
  const changing = character.setExpression("smile");
  await flush();
  assert.deepEqual(harness.animations.map(({ timing }) => timing.duration), [250, 250]);
  assert.equal(otherImage.src, "normal.svg");
  assert.equal(otherImage.animations.length, 0);
  harness.animations.forEach(({ animation }) => animation.finish());
  await changing;
  for (const value of [-1, NaN, Infinity]) {
    assert.throws(() => new SpriteRenderer({ crossfadeDuration: value }), /crossfadeDuration/);
  }
});
