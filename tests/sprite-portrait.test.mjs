import test from "node:test";
import assert from "node:assert/strict";
import { SpriteRenderer } from "../dist/index.js";

class Style {
  properties = new Map();
  setProperty(name, value) { this.properties.set(name, value); }
  getPropertyValue(name) { return this.properties.get(name) ?? ""; }
  removeProperty(name) { this.properties.delete(name); }
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

class Element {
  dataset = {};
  style = new Style();
  children = [];
  parentElement;
  animations = [];

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
  animate(keyframes, timing) {
    const animation = new FakeAnimation();
    this.animations.push({ keyframes, timing, animation });
    return animation;
  }
}

class ImageElement extends Element {
  writes = [];
  set src(value) { this.writes.push(value); this.source = value; }
  get src() { return this.source; }
  decode() { return Promise.resolve(); }
}

function setup(t) {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tag) => tag === "img" ? new ImageElement() : new Element(),
  };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });
  const host = new Element();
  const renderer = new SpriteRenderer();
  const create = (id, assets) => renderer.create(host, {
    id,
    name: id,
    renderer: "sprite",
    assets: {
      expressions: { normal: `${id}-normal.svg`, smile: `${id}-smile.svg` },
      ...assets,
    },
  });
  return { host, create };
}

function rootOf(host, index = 0) { return host.children[index]; }
function visualOf(host, index = 0) { return rootOf(host, index).children[0]; }
function imageOf(host, index = 0) { return visualOf(host, index).children[0]; }
function portraitProperties(root) {
  return [
    root.style.getPropertyValue("--adv-portrait-scale"),
    root.style.getPropertyValue("--adv-portrait-anchor-x"),
    root.style.getPropertyValue("--adv-portrait-anchor-y"),
  ];
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

test("portrait mode is implied by portrait settings and uses normalized defaults", async (t) => {
  const { host, create } = setup(t);
  const implied = create("implied", { portrait: {} });
  const explicit = create("explicit", {
    displayMode: "portrait",
    portrait: { scale: 1.4, anchorX: 0.3, anchorY: -0.2 },
  });

  await Promise.all([implied.show(), explicit.show()]);
  assert.equal(rootOf(host, 0).dataset.displayMode, "portrait");
  assert.deepEqual(portraitProperties(rootOf(host, 0)), ["1", "0.5", "0"]);
  assert.equal(rootOf(host, 1).dataset.displayMode, "portrait");
  assert.deepEqual(portraitProperties(rootOf(host, 1)), ["1.4", "0.3", "-0.2"]);
  assert.equal(rootOf(host, 0).children.length, 1);
  assert.equal(visualOf(host, 0).children.length, 1);
  assert.equal(imageOf(host, 0).src, "implied-normal.svg");
});

test("fullbody remains the legacy default and explicit fullbody keeps configured portrait values", (t) => {
  const { host, create } = setup(t);
  create("legacy", {});
  create("configured", {
    displayMode: "fullbody",
    portrait: { scale: 1.2, anchorX: 0.4, anchorY: 0.1 },
  });

  assert.equal(rootOf(host, 0).dataset.displayMode, "fullbody");
  assert.deepEqual(portraitProperties(rootOf(host, 0)), ["1", "0.5", "0"]);
  assert.equal(rootOf(host, 1).dataset.displayMode, "fullbody");
  assert.deepEqual(portraitProperties(rootOf(host, 1)), ["1.2", "0.4", "0.1"]);
  assert.equal(rootOf(host, 0).children.length, 1);
  assert.equal(visualOf(host, 0).children.length, 1);
});

test("runtime display mode changes preserve image source, portrait settings, and other characters", async (t) => {
  const { host, create } = setup(t);
  const first = create("first", {
    portrait: { scale: 1.6, anchorX: 0.25, anchorY: -0.15 },
  });
  create("second", { displayMode: "fullbody" });
  await first.show();

  const root = rootOf(host, 0);
  const image = imageOf(host, 0);
  const writes = image.writes.length;
  first.setDisplayMode("fullbody");
  assert.equal(root.dataset.displayMode, "fullbody");
  assert.deepEqual(portraitProperties(root), ["1.6", "0.25", "-0.15"]);
  first.setDisplayMode("portrait");
  assert.equal(root.dataset.displayMode, "portrait");
  assert.deepEqual(portraitProperties(root), ["1.6", "0.25", "-0.15"]);
  assert.equal(image.src, "first-normal.svg");
  assert.equal(image.writes.length, writes);
  assert.equal(rootOf(host, 1).dataset.displayMode, "fullbody");
  assert.equal(imageOf(host, 1).src, "second-normal.svg");
});

test("expression crossfade keeps portrait layout settings for the image and ghost", async (t) => {
  const { host, create } = setup(t);
  const character = create("fade", {
    displayMode: "portrait",
    portrait: { scale: 1.3, anchorX: 0.4, anchorY: -0.1 },
  });
  await character.show();

  const root = rootOf(host);
  const visual = visualOf(host);
  const image = imageOf(host);
  const changing = character.setExpression("smile");
  await flush();

  const ghost = visual.children[1];
  assert.equal(root.dataset.displayMode, "portrait");
  assert.deepEqual(portraitProperties(root), ["1.3", "0.4", "-0.1"]);
  assert.equal(image.src, "fade-smile.svg");
  assert.equal(ghost.src, "fade-normal.svg");
  assert.equal(ghost.alt, "");
  assert.equal(ghost["aria-hidden"], "true");
  assert.equal(visual.children.length, 2);

  visual.children.forEach((child) => child.animations.forEach(({ animation }) => animation.finish()));
  await changing;
  assert.deepEqual(visual.children, [image]);
});

test("portrait configuration does not move motion animation off the visual wrapper", (t) => {
  const { host, create } = setup(t);
  const character = create("motion", {
    displayMode: "portrait",
    portrait: { scale: 1.5, anchorX: 0.2, anchorY: -0.25 },
    motions: { bob: { keyframes: [{ translate: "0 0" }, { translate: "0 -8px" }] } },
  });

  character.playMotion("bob");
  const root = rootOf(host);
  const visual = visualOf(host);
  assert.equal(visual.animations.length, 1);
  assert.equal(root.animations.length, 0);
  assert.deepEqual(portraitProperties(root), ["1.5", "0.2", "-0.25"]);
  assert.equal(root.dataset.displayMode, "portrait");
});

test("portrait scale must be finite and positive, and anchors must be finite", (t) => {
  const { create } = setup(t);
  for (const scale of [0, -1, NaN, Infinity]) {
    assert.throws(() => create(`scale-${String(scale)}`, { portrait: { scale } }), /portrait/i);
  }
  for (const anchor of [NaN, Infinity, -Infinity]) {
    assert.throws(() => create(`anchor-x-${String(anchor)}`, { portrait: { anchorX: anchor } }), /portrait/i);
    assert.throws(() => create(`anchor-y-${String(anchor)}`, { portrait: { anchorY: anchor } }), /portrait/i);
  }
});
