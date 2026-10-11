import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { presentEpisodeTitle } from "../examples/generic/controls.mjs";

function fixture() {
  const chapter = { textContent: "", hidden: false };
  const title = { textContent: "", hidden: false };
  return {
    root: { dataset: {} },
    element: {
      dataset: {}, hidden: true,
      querySelector(selector) { return selector.endsWith("chapter") ? chapter : title; },
    },
    chapter, title,
  };
}

test("episode title presents centered metadata and fades out when animation is enabled", async () => {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: false });
  try {
    const f = fixture();
    await presentEpisodeTitle(f.root, f.element, { chapter: "CH.1", title: "Sample One" }, { durationMs: 0, fadeDurationMs: 0 });
    assert.equal(f.root.dataset.mode, "intro");
    assert.equal(f.chapter.textContent, "CH.1");
    assert.equal(f.title.textContent, "Sample One");
    assert.equal(f.element.hidden, true);
    assert.equal(f.element.dataset.phase, undefined);
  } finally {
    globalThis.matchMedia = original;
  }
});

test("episode title shortens to a static card when UI animation is disabled or reduced", async () => {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: false });
  try {
    const f = fixture();
    f.root.dataset.uiAnimation = "off";
    await presentEpisodeTitle(f.root, f.element, { title: "Only a title" }, { durationMs: 10000 });
    assert.equal(f.element.hidden, true);
    assert.equal(f.chapter.hidden, true);
    assert.equal(f.title.textContent, "Only a title");
  } finally {
    globalThis.matchMedia = () => ({ matches: true });
    const f = fixture();
    await presentEpisodeTitle(f.root, f.element, { chapter: "CH.1" }, { durationMs: 10000 });
    assert.equal(f.element.hidden, true);
    globalThis.matchMedia = original;
  }
});

test("Generic episode card has calm fade and centered chapter/title typography", async () => {
  const css = await readFile(new URL("../examples/generic/style.css", import.meta.url), "utf8");
  assert.match(css, /\.game \.episode-title\s*\{[^}]*inset:\s*0/);
  assert.match(css, /\.game \.episode-title\[data-phase="out"\][^}]*700ms/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
