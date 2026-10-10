import test from "node:test";
import assert from "node:assert/strict";
import { AdvEngine, DomUi } from "../dist/index.js";

class Element extends EventTarget {
  dataset = {};
  textContent = "";
  hidden = false;
  children = [];
  scrollTop = 0;
  clientWidth = 100;
  get scrollHeight() { return this.clientHeight ? Math.ceil(this.textContent.length / 10) * 20 : 0; }
  clientHeight = 0;
  replaceChildren() { this.children = []; }
}

test("DomUi replaces the last clickable line with a visible end state", async (t) => {
  const previousWindow = globalThis.window;
  globalThis.window = new EventTarget();
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  const elements = Object.fromEntries(
    ["root", "background", "speaker", "text", "choices", "advanceTarget"]
      .map((name) => [name, new Element()]),
  );
  const ui = new DomUi(elements);
  const stage = { setActive() {}, getName() { return "Alice"; }, destroy() {} };
  const engine = new AdvEngine({
    game: { start: "start", characters: [], scenes: { start: [
      { type: "line", speaker: "a", text: "Click to finish" }, { type: "end" },
    ] } }, stage, ui,
  });
  const run = engine.run();
  while (elements.root.dataset.mode !== "line") await Promise.resolve();
  assert.equal(elements.text.textContent, "Click to finish");
  assert.equal(engine.ended, false);
  elements.advanceTarget.dispatchEvent(new Event("click"));
  await run;
  assert.equal(elements.root.dataset.mode, "ended");
  assert.equal(elements.text.textContent, "The End");
  assert.equal(elements.speaker.textContent, "");
  assert.equal(elements.speaker.hidden, true);
  assert.equal(elements.root.dataset.speaker, "");
  assert.deepEqual(elements.choices.children, []);
  const key = new Event("keydown", { cancelable: true });
  Object.defineProperty(key, "key", { value: "Enter" });
  window.dispatchEvent(key);
  assert.equal(key.defaultPrevented, false);
  elements.advanceTarget.dispatchEvent(new Event("click"));
  assert.equal(elements.root.dataset.mode, "ended");
});

test("DomUi keeps short and multiline lines readable and advances the node only after every long-text page", async (t) => {
  const previousWindow = globalThis.window;
  globalThis.window = new EventTarget();
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  const elements = Object.fromEntries(
    ["root", "background", "speaker", "text", "choices", "advanceTarget"]
      .map((name) => [name, new Element()]),
  );
  const lines = ["短い台詞です。", "一行目です。\n二行目です。", "長文の台詞です。".repeat(12)];
  const ui = new DomUi(elements);
  const stage = { setActive() {}, getName() { return "Alice"; }, destroy() {} };
  const engine = new AdvEngine({
    game: { start: "start", characters: [], scenes: { start: [
      ...lines.map((text) => ({ type: "line", text })), { type: "end" },
    ] } }, stage, ui,
  });

  const run = engine.run();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(elements.text.textContent, lines[0]);
  elements.advanceTarget.dispatchEvent(new Event("click", { cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(elements.text.textContent, lines[1]);
  assert.equal(elements.text.scrollTop, 0);

  elements.text.clientHeight = 40;
  elements.advanceTarget.dispatchEvent(new Event("click", { cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.notEqual(elements.text.textContent, lines[2]);
  const pages = [];
  while (!engine.ended) {
    pages.push(elements.text.textContent);
    assert.equal(elements.text.scrollTop, 0);
    const key = new Event("keydown", { cancelable: true });
    Object.defineProperty(key, "key", { value: "Enter" });
    window.dispatchEvent(key);
    assert.equal(key.defaultPrevented, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await run;
  assert.ok(pages.length >= 3);
  assert.equal(pages.join(""), lines[2]);
  assert.equal(elements.root.dataset.mode, "ended");
});
