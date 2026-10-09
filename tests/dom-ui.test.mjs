import test from "node:test";
import assert from "node:assert/strict";
import { AdvEngine, DomUi } from "../dist/index.js";

class Element extends EventTarget {
  dataset = {};
  textContent = "";
  hidden = false;
  children = [];
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
