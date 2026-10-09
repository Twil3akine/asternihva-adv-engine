import test from "node:test";
import assert from "node:assert/strict";
import { SpriteRenderer } from "../dist/index.js";

class Style {
  properties = new Map();
  setProperty(name, value) { this.properties.set(name, value); }
  getPropertyValue(name) { return this.properties.get(name) ?? ""; }
  removeProperty(name) { this.properties.delete(name); }
  set zIndex(value) { this.setProperty("z-index", value); }
  get zIndex() { return this.getPropertyValue("z-index"); }
}

class Element {
  decode() { return Promise.resolve(); }
  dataset = {};
  style = new Style();
  children = [];
  append(child) { this.children.push(child); }
}

test("sprite positions clear omitted zIndex and preserve position behavior", (t) => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });
  const host = new Element();
  const character = new SpriteRenderer().create(host, {
    id: "a", name: "Alice", renderer: "sprite", assets: { default: "alice.svg" },
  });
  const root = host.children[0];
  character.setPosition({ x: 20, y: 10, scale: 2, zIndex: 5 });
  assert.equal(root.style.zIndex, "5");
  character.setPosition({ x: 40 });
  assert.equal(root.style.zIndex, "");
  assert.equal(root.dataset.position, "custom");
  assert.equal(root.style.getPropertyValue("--adv-x"), "40%");
  assert.equal(root.style.getPropertyValue("--adv-y"), "0%");
  assert.equal(root.style.getPropertyValue("--adv-scale"), "1");

  character.setPosition({ x: 60, y: 15, scale: 1.5, zIndex: 0 });
  assert.equal(root.style.zIndex, "0");
  assert.equal(root.style.getPropertyValue("--adv-y"), "15%");
  assert.equal(root.style.getPropertyValue("--adv-scale"), "1.5");
  character.setPosition({ x: 30, zIndex: -1 });
  assert.equal(root.style.zIndex, "-1");
  character.setPosition("left");
  assert.equal(root.dataset.position, "left");
  assert.equal(root.style.zIndex, "");
  for (const property of ["--adv-x", "--adv-y", "--adv-scale"]) {
    assert.equal(root.style.getPropertyValue(property), "");
  }
});

class ImageElement extends Element {
  writes = [];
  set src(value) { this.writes.push(value); this.source = value; }
  get src() { return this.source; }
  decode() { return this.source === "broken.svg" ? Promise.reject(new Error("load failed")) : Promise.resolve(); }
}

function sprites(t) {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tag) => tag === "img" ? new ImageElement() : new Element() };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
  const host = new Element();
  const renderer = new SpriteRenderer();
  const create = (id, defaultExpression) => renderer.create(host, {
    id, name: id, renderer: "sprite", defaultExpression,
    assets: { expressions: { normal: `${id}-normal.svg`, smile: `${id}-smile.svg`, surprised: `${id}-surprised.svg`, broken: "broken.svg" } },
  });
  return { host, create };
}

test("sprite initial expression uses the configured default or normal", async (t) => {
  const { host, create } = sprites(t);
  const a = create("a", "smile");
  const b = create("b");
  await Promise.all([a.show(), b.show()]);
  assert.equal(host.children[0].children[0].children[0].src, "a-smile.svg");
  assert.equal(host.children[1].children[0].children[0].src, "b-normal.svg");
});

test("sprite expression changes are isolated and identical requests do not rewrite src", async (t) => {
  const { host, create } = sprites(t);
  const a = create("a");
  const b = create("b");
  await Promise.all([a.show(), b.show()]);
  const image = host.children[0].children[0].children[0];
  await a.setExpression("smile");
  assert.equal(image.src, "a-smile.svg");
  const writes = image.writes.length;
  await a.setExpression("smile");
  assert.equal(image.writes.length, writes);
  await a.setExpression("surprised");
  assert.equal(image.src, "a-surprised.svg");
  assert.equal(host.children[1].children[0].children[0].src, "b-normal.svg");
});

test("unknown expressions and failed images preserve the current sprite", async (t) => {
  const { host, create } = sprites(t);
  const a = create("a");
  await a.show();
  const image = host.children[0].children[0].children[0];
  await a.setExpression("missing");
  await a.setExpression("broken");
  assert.deepEqual(image.writes, ["a-normal.svg"]);
});

test("sprite retains its image while decoding and ignores stale requests", async (t) => {
  const { host, create } = sprites(t);
  const pending = new Map();
  globalThis.document.createElement = (tag) => {
    if (tag !== "img") return new Element();
    const image = new ImageElement();
    image.decode = () => new Promise((resolve) => { pending.set(image.src, resolve); });
    return image;
  };
  const a = create("a");
  pending.get("a-normal.svg")();
  await a.show();
  const image = host.children[0].children[0].children[0];
  const smile = a.setExpression("smile");
  assert.equal(image.src, "a-normal.svg");
  const surprised = a.setExpression("surprised");
  pending.get("a-surprised.svg")();
  await surprised;
  pending.get("a-smile.svg")();
  await smile;
  assert.equal(image.src, "a-surprised.svg");
});

test("sprite initial fallback and legacy flat assets remain supported", async (t) => {
  const { host } = sprites(t);
  const renderer = new SpriteRenderer();
  const definitions = [
    { defaultExpression: "missing", assets: { expressions: { normal: "normal.svg" } } },
    { assets: { default: "default.svg", smile: "smile.svg" } },
    { assets: { expressions: { smile: "smile.svg" } } },
    { assets: { expressions: {} } },
  ];
  for (const definition of definitions) {
    await renderer.create(host, { id: "a", name: "Alice", renderer: "sprite", ...definition }).show();
  }
  assert.deepEqual(host.children.map((root) => root.children[0].children[0].src),
    ["normal.svg", "default.svg", "smile.svg", undefined]);
});
