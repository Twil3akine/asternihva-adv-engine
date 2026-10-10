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
  get scrollWidth() { return this.clientWidth; }
  get scrollHeight() { return this.clientHeight ? Math.ceil(this.textContent.length / 10) * 20 : 0; }
  clientHeight = 0;
  style = { setProperty() {} };
  setAttribute() {}
  append(child) { this.children.push(child); }
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

function fakeUi(t) {
  const previous = { window: globalThis.window, document: globalThis.document, getComputedStyle: globalThis.getComputedStyle };
  globalThis.window = new EventTarget();
  globalThis.document = { createElement: () => new Element() };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => "180" });
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  });
  const elements = Object.fromEntries(["root", "background", "speaker", "text", "choices", "advanceTarget"].map(name => [name, new Element()]));
  return { elements, ui: new DomUi(elements) };
}

test("DomUi resize preserves the current page offset and the complete original text", async t => {
  const { elements, ui } = fakeUi(t);
  elements.text.clientHeight = 40;
  const original = "あいうえおかきくけこ。".repeat(12);
  const pending = ui.presentLine({ text: original });
  const parts = [elements.text.textContent];
  elements.advanceTarget.dispatchEvent(new Event("click"));
  elements.text.clientHeight = 20;
  window.dispatchEvent(new Event("resize"));
  let done = false;
  pending.then(() => { done = true; });
  while (!done) {
    parts.push(elements.text.textContent);
    elements.advanceTarget.dispatchEvent(new Event("click"));
    await Promise.resolve();
  }
  assert.equal(parts.join(""), original);
  assert.equal(elements.text.scrollTop, 0);
});

test("DomUi always shows the same down cue while page state stays internal", async t => {
  const { elements } = fakeUi(t);
  elements.text.clientHeight = 40;
  const indicator = new Element();
  const pagedUi = new DomUi({ ...elements, pageIndicator: indicator });
  const original = "長い文章です。".repeat(10);
  const pending = pagedUi.presentLine({ text: original });
  let done = false;
  pending.then(() => { done = true; });
  assert.equal(indicator.textContent, "▼");
  assert.equal(elements.root.dataset.page, "1");
  elements.advanceTarget.dispatchEvent(new Event("click"));
  await Promise.resolve();
  assert.equal(indicator.textContent, "▼");
  assert.equal(elements.root.dataset.page, "2");
  while (!done) {
    elements.advanceTarget.dispatchEvent(new Event("click"));
    await Promise.resolve();
    assert.equal(indicator.textContent, "▼");
  }
  await pending;
});

test("the single down cue also remains unchanged on a final page before node advance", async t => {
  const { elements } = fakeUi(t);
  const indicator = new Element();
  const ui = new DomUi({ ...elements, pageIndicator: indicator });
  const pending = ui.presentLine({ text: "短い台詞。" });
  assert.equal(indicator.textContent, "▼");
  elements.advanceTarget.dispatchEvent(new Event("click"));
  await pending;
  assert.equal(indicator.textContent, "▼");
  assert.doesNotMatch(indicator.textContent, /\d|[>/]/);
});

test("DomUi choices resolve exactly once after the selection fade", async t => {
  const { elements, ui } = fakeUi(t);
  let finish, timing;
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => ".2s" });
  elements.choices.animate = (frames, options) => { timing = options; return ({ finished: new Promise(resolve => { finish = resolve; }), cancel() {} }); };
  const pending = ui.presentChoice({ options: Array.from({ length: 12 }, (_, index) => String(index)) });
  assert.equal(elements.choices.children.length, 12);
  const buttons = [...elements.choices.children];
  let settled = false;
  pending.then(() => { settled = true; });
  buttons[11].dispatchEvent(new Event("click"));
  buttons[0].dispatchEvent(new Event("click"));
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(timing.duration, 200);
  finish();
  assert.equal(await pending, 11);
  assert.deepEqual(elements.choices.children, []);
});

test("DomUi ending aborts pending choice input", async t => {
  const { elements, ui } = fakeUi(t);
  let settled = false;
  ui.presentChoice({ options: ["first", "second"] }).then(() => { settled = true; });
  const staleButton = elements.choices.children[0];
  ui.presentEnd();
  staleButton.dispatchEvent(new Event("click"));
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(elements.root.dataset.mode, "ended");
});

test("viewport input advances exactly one page per background, character, or dialogue click", async t => {
  const { elements } = fakeUi(t);
  elements.text.clientHeight = 20;
  const ui = new DomUi({ ...elements, advanceTarget: elements.root });
  let done = false;
  const pending = ui.presentLine({ text: "あ".repeat(40) }).then(() => { done = true; });
  for (const name of ["background", "character", "dialogue"]) {
    const event = new Event("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: { closest: () => null, name } });
    elements.root.dispatchEvent(event);
    await Promise.resolve();
    assert.equal(elements.root.dataset.page, String(["background", "character", "dialogue"].indexOf(name) + 2));
    assert.equal(done, false);
  }
  elements.root.dispatchEvent(new Event("click"));
  await pending;
  assert.equal(done, true);
});

test("viewport input consumes interactive controls and blocks all open overlays", async t => {
  const { elements } = fakeUi(t);
  const ui = new DomUi({ ...elements, advanceTarget: elements.root });
  let done = false;
  const pending = ui.presentLine({ text: "会話" }).then(() => { done = true; });
  for (const name of ["AUTO", "SKIP", "LOG", "MENU", "Settings", "link", "input"]) {
    const event = new Event("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: { closest: selector => {
      assert.match(selector, /button/);
      assert.match(selector, /data-adv-interactive/);
      return { name };
    } } });
    elements.root.dispatchEvent(event);
    await Promise.resolve();
    assert.equal(done, false, name);
  }
  for (const name of ["Menu", "Log", "Settings"]) {
    elements.root.querySelector = () => ({ name });
    elements.root.dispatchEvent(new Event("click"));
    const key = new Event("keydown", { cancelable: true });
    Object.defineProperty(key, "key", { value: "Enter" });
    window.dispatchEvent(key);
    await Promise.resolve();
    assert.equal(done, false, name);
    assert.equal(key.defaultPrevented, false);
  }
  elements.root.querySelector = () => null;
  const consumed = new Event("click", { cancelable: true });
  consumed.preventDefault();
  elements.root.dispatchEvent(consumed);
  await Promise.resolve();
  assert.equal(done, false);
  elements.root.dispatchEvent(new Event("click"));
  await pending;
});

test("viewport input ignores intro, choice background and ended modes", async t => {
  const { elements } = fakeUi(t);
  const ui = new DomUi({ ...elements, advanceTarget: elements.root });
  let done = false;
  const pending = ui.presentLine({ text: "会話" }).then(() => { done = true; });
  for (const mode of ["intro", "choice", "ended"]) {
    elements.root.dataset.mode = mode;
    elements.root.dispatchEvent(new Event("click"));
    await Promise.resolve();
    assert.equal(done, false, mode);
  }
  elements.root.dataset.mode = "line";
  elements.root.dispatchEvent(new Event("click"));
  await pending;
  const choice = ui.presentChoice({ options: ["選ぶ"] });
  let selected = false;
  choice.then(() => { selected = true; });
  elements.root.dispatchEvent(new Event("click"));
  await Promise.resolve();
  assert.equal(selected, false);
  elements.choices.children[0].dispatchEvent(new Event("click"));
  assert.equal(await choice, 0);
  ui.presentEnd();
  elements.root.dispatchEvent(new Event("click"));
  assert.equal(elements.root.dataset.mode, "ended");
});
