import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SampleUi } from "../examples/generic/controls.mjs";

test("Generic end state uses a separate episode card and preserves replay", async () => {
  const root = { dataset: {}, querySelectorAll: () => [] };
  const makeElement = () => ({ textContent: "", hidden: false, replaceChildren() {}, setAttribute() {} });
  const title = { textContent: "" };
  let replayClick;
  const replay = { addEventListener(_name, listener) { replayClick = listener; } };
  const endCard = { hidden: true, querySelector(selector) { return selector === "#end-title" ? title : replay; } };
  const ui = new SampleUi({ root, background: makeElement(), speaker: makeElement(), text: makeElement(), choices: makeElement() }, {
    endCard, scenario: { title: "Sample One" },
  });
  ui.presentEnd();
  assert.equal(root.dataset.mode, "ended");
  assert.equal(ui.root.dataset.speaker, "");
  assert.equal(endCard.hidden, false);
  assert.equal(title.textContent, "Sample One");
  assert.equal(typeof replayClick, "function");
});

test("the end card replaces the dialogue surface and dims the stage", async () => {
  const html = await readFile(new URL("../examples/generic/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../examples/generic/style.css", import.meta.url), "utf8");
  assert.match(html, /id="end-card"[^>]*hidden/);
  assert.match(html, /もう一度読む/);
  assert.match(css, /\.game\[data-mode="ended"\] #dialogue\s*\{\s*display:\s*none/);
  assert.match(css, /\.game\[data-mode="ended"\] \.adv-scenario-title\s*\{\s*visibility:\s*hidden/);

});

test("destroying a demo UI removes its replay handler before a new scenario uses the end card", () => {
  const replay = new EventTarget();
  const endCard = { querySelector: () => replay };
  const element = () => ({ replaceChildren() {}, setAttribute() {} });
  let calls = 0;
  const ui = new SampleUi({ root: { dataset: {} }, background: element(), speaker: element(), text: element(), choices: element() }, {
    endCard, onReplay: () => calls++,
  });
  replay.dispatchEvent(new Event('click'));
  assert.equal(calls, 1);
  ui.destroy();
  replay.dispatchEvent(new Event('click'));
  assert.equal(calls, 1);
});
