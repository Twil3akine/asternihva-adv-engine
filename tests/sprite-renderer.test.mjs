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
