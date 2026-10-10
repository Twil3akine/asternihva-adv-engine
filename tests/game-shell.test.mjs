import test from "node:test";
import assert from "node:assert/strict";
import { attachGameShell } from "../examples/asternihva/game-shell.mjs";
import { renderChapterSelect } from "../examples/asternihva/chapter-select.mjs";

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.dataset = {};
    this.attributes = {};
    this.children = [];
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.className = "";
    this.type = "";
    this.focused = false;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ target: this, preventDefault() {}, ...event });
    }
  }

  click() { this.dispatch("click"); }
  focus() { this.focused = true; globalThis.document.activeElement = this; }
  blur() { this.focused = false; }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
}

function makeShellFixture() {
  const title = new FakeElement("section");
  const chapters = new FakeElement("section");
  const chapterList = new FakeElement("div");
  const start = new FakeElement("button");
  const chapter = new FakeElement("button");
  const titleAction = new FakeElement("button");
  const settings = new FakeElement("button");
  const endChapters = new FakeElement("button");
  const status = new FakeElement("p");
  title.querySelector = () => start;
  chapters.querySelector = () => titleAction;

  const selectors = new Map([
    ["#title-screen", title], ["#chapter-screen", chapters],
    ["#chapter-list", chapterList], ["[data-shell-action=\"start\"]", start],
    ["[data-shell-action=\"chapter\"]", chapter], ["[data-shell-action=\"title\"]", titleAction],
    ["[data-shell-action=\"settings\"]", settings], ["[data-end-chapters]", endChapters],
    ["#asset-status", status],
  ]);
  const root = new FakeElement("main");
  root.querySelector = selector => selectors.get(selector);
  const previousDocument = globalThis.document;
  globalThis.document = {
    activeElement: null,
    createElement: tagName => new FakeElement(tagName),
  };
  return {
    root, title, chapters, chapterList, start, chapter, titleAction, settings, endChapters, status,
    restoreDocument() { globalThis.document = previousDocument; },
  };
}

test("game shell renders ordered chapters and guards navigation and scenario starts", async () => {
  const fixture = makeShellFixture();
  const entries = [
    { id: "ep00", chapter: "EP.00", title: "小さな光", description: "夜の物語", entry: {} },
    { id: "ep01", chapter: "EP.01", title: "次の章", entry: {} },
  ];
  const catalog = {
    getScenarios: () => entries,
    getScenarioMetadata: id => entries.find(entry => entry.id === id),
  };
  let settingsCalls = 0;
  let startCalls = 0;
  let leaveCalls = 0;
  let releaseStart;
  const starting = new Promise(resolve => { releaseStart = resolve; });

  try {
    const shell = attachGameShell(fixture.root, catalog, {
      onStart: () => { startCalls++; return starting; },
      onLeave: () => { leaveCalls++; },
      onSettings: () => { settingsCalls++; },
    });

    assert.equal(fixture.root.dataset.screen, "title");
    assert.equal(fixture.title.hidden, false);
    assert.equal(fixture.chapters.hidden, true);
    assert.equal(fixture.start.focused, true);

    fixture.chapter.click();
    assert.equal(fixture.root.dataset.screen, "chapter");
    assert.deepEqual(fixture.chapterList.children.map(child => child.children.at(-1).dataset.scenarioId), ["ep00", "ep01"]);
    const firstChapter = fixture.chapterList.children[0];
    assert.equal(firstChapter.children.some(child => child.className === "chapter-label" && child.textContent === "EP.00"), true);
    assert.equal(firstChapter.children.some(child => child.tagName === "h3" && child.textContent === "小さな光"), true);
    assert.equal(firstChapter.children.some(child => child.textContent === "夜の物語"), true);
    const secondChapter = fixture.chapterList.children[1];
    assert.equal(secondChapter.children.some(child => child.textContent === "次の章"), true);
    assert.equal(secondChapter.children.some(child => child.tagName === "p" && child.className === ""), false);

    let prevented = false;
    fixture.root.dispatch("keydown", { key: "Escape", preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(fixture.root.dataset.screen, "title");
    assert.equal(fixture.title.hidden, false);
    assert.equal(fixture.chapters.hidden, true);

    fixture.settings.click();
    assert.equal(settingsCalls, 1);
    await shell.start("missing");
    assert.equal(startCalls, 0);
    assert.equal(fixture.root.dataset.screen, "title");

    const firstStart = shell.start("ep01");
    await shell.start("ep01");
    assert.equal(startCalls, 1);
    assert.equal(fixture.root.dataset.screen, "game");
    assert.equal(fixture.root.dataset.mode, "intro");
    releaseStart({ finished: Promise.resolve() });
    await firstStart;
    assert.equal(fixture.root.dataset.screen, "game");
    assert.equal(leaveCalls >= 3, true);
  } finally {
    fixture.restoreDocument();
  }
});

test("chapter select omits absent descriptions", () => {
  const fixture = makeShellFixture();
  try {
    const catalog = {
      getScenarios: () => [{ id: "ep00", chapter: "EP.00", title: "小さな光", entry: {} }],
    };
    const played = [];
    renderChapterSelect(fixture.chapterList, catalog, id => played.push(id));
    const [entry] = fixture.chapterList.children;
    assert.equal(entry.children.some(child => child.tagName === "p" && child.className === ""), false);
    entry.children.at(-1).click();
    assert.deepEqual(played, ["ep00"]);
  } finally {
    fixture.restoreDocument();
  }
});

test('chapter selection restores the current chapter and wraps arrow navigation', () => {
  const fixture = makeShellFixture();
  try {
    const catalog = { getScenarios: () => [0, 1, 2].map(index => ({ id: `s${index}`, title: 'Test scene' })) };
    const controller = renderChapterSelect(fixture.chapterList, catalog, () => {}, 's1');
    controller.focus();
    const rows = fixture.chapterList.children;
    assert.equal(rows[1].dataset.selected, 'true');
    rows[1].children.at(-1).dispatch('keydown', { key: 'ArrowDown' });
    assert.equal(rows[2].dataset.selected, 'true');
    rows[2].children.at(-1).dispatch('keydown', { key: 'ArrowDown' });
    assert.equal(rows[0].dataset.selected, 'true');
    rows[0].children.at(-1).dispatch('keydown', { key: 'ArrowUp' });
    assert.equal(rows[2].dataset.selected, 'true');
  } finally { fixture.restoreDocument(); }
});

test('shell records play and completion and chapters show status', async () => {
  const fixture = makeShellFixture();
  const { ChapterProgressStore } = await import('../dist/web.js');
  const progress = new ChapterProgressStore();
  let finish;
  const catalog = { getScenarios: () => [{ id: 'sample', title: 'Test scene' }], getScenarioMetadata: id => id === 'sample' ? { id } : undefined };
  try {
    const shell = attachGameShell(fixture.root, catalog, {
      progress, onLeave() {}, onSettings() {},
      onStart: () => ({ finished: new Promise(resolve => { finish = resolve; }) }),
    });
    shell.showChapters();
    assert.equal(fixture.chapterList.children[0].children.find(child => child.className === 'chapter-progress').textContent, 'NEW');
    await shell.start('sample');
    assert.equal(progress.getStatus('sample'), 'PLAYED');
    finish(); await Promise.resolve();
    shell.showChapters();
    assert.equal(fixture.chapterList.children[0].children.find(child => child.className === 'chapter-progress').textContent, 'CLEAR');
    assert.equal(progress.snapshot().lastPlayedId, 'sample');
  } finally { fixture.restoreDocument(); }
});
