import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DemoUi } from "../examples/asternihva/demo-controls.mjs";

test("Asternihva end state uses a separate episode card and preserves replay", async () => {
  const root = { dataset: {}, querySelectorAll: () => [] };
  const makeElement = () => ({ textContent: "", hidden: false, replaceChildren() {}, setAttribute() {} });
  const title = { textContent: "" };
  let replayClick;
  const replay = { addEventListener(_name, listener) { replayClick = listener; } };
  const endCard = { hidden: true, querySelector(selector) { return selector === "#end-title" ? title : replay; } };
  const ui = new DemoUi({ root, background: makeElement(), speaker: makeElement(), text: makeElement(), choices: makeElement() }, {
    endCard, scenario: { title: "小さな光" },
  });
  ui.presentEnd();
  assert.equal(root.dataset.mode, "ended");
  assert.equal(ui.root.dataset.speaker, "");
  assert.equal(endCard.hidden, false);
  assert.equal(title.textContent, "小さな光");
  assert.equal(typeof replayClick, "function");
});

test("the end card replaces the dialogue surface and dims the stage", async () => {
  const html = await readFile(new URL("../examples/asternihva/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../examples/asternihva/theme.css", import.meta.url), "utf8");
  assert.match(html, /id="end-card"[^>]*hidden/);
  assert.match(html, /もう一度読む/);
  assert.match(css, /\.game\[data-mode="ended"\] #dialogue\s*\{\s*display:\s*none/);
  assert.match(css, /\.game\[data-mode="ended"\] \.adv-scenario-title\s*\{\s*visibility:\s*hidden/);
  assert.match(css, /\.game\[data-mode="ended"\]::after\s*\{\s*opacity:\s*\.64/);
});
