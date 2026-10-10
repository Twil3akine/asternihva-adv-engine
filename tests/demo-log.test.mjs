import test from "node:test";
import assert from "node:assert/strict";
import { createLogEntry, renderLogEntries, resolveLogPortrait } from "../examples/asternihva/demo-log.mjs";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.classes = new Set();
    this.classList = { add: (...names) => names.forEach(name => this.classes.add(name)) };
    this.style = { values: {}, setProperty: (name, value) => { this.style.values[name] = value; } };
    this.textContent = "";
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  remove() { this.removed = true; }
}

function withFakeDocument(t) {
  const previous = globalThis.document;
  globalThis.document = { createElement: tagName => new FakeElement(tagName) };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
}

const iconMap = {
  noa: { expressions: { calm: "/icons/noa-calm.svg", bright: "/icons/noa-bright.svg" }, portrait: { scale: 2.4, anchorX: 0.4, anchorY: 0.2 } },
  anya: { expressions: { calm: "/icons/anya-calm.svg" } },
};

test("createLogEntry maps the line fields into a frozen presentation record", () => {
  const entry = createLogEntry({ speakerId: "noa", speakerName: "Noa", text: "Hello", expression: "bright" });
  assert.deepEqual(entry, {
    speakerId: "noa", displayName: "Noa", fullText: "Hello", expressionId: "bright", narration: false,
  });
  assert.equal(Object.isFrozen(entry), true);
});

test("createLogEntry marks missing-speaker and empty-speaker lines as narration", () => {
  assert.equal(createLogEntry({ text: "A thought" }).narration, true);
  assert.equal(createLogEntry({ speakerId: "", speakerName: "", text: "A thought" }).narration, true);
});

test("createLogEntry preserves arbitrary speaker ids and full multiline text", () => {
  const text = "First line.\nSecond line.\nThird line.";
  const entry = createLogEntry({ speakerId: "guest-17", speakerName: "Guest", text, expression: "quiet" });
  assert.equal(entry.speakerId, "guest-17");
  assert.equal(entry.fullText, text);
  assert.equal(entry.expressionId, "quiet");
});

test("resolveLogPortrait uses the exact speaker expression and portrait settings", () => {
  const entry = createLogEntry({ speakerId: "noa", speakerName: "Noa", text: "Hi", expression: "bright" });
  assert.deepEqual(resolveLogPortrait(entry, iconMap), {
    source: "/icons/noa-bright.svg", scale: 2.4, anchorX: 0.4, anchorY: 0.2,
  });
});

test("resolveLogPortrait supplies default portrait settings when omitted", () => {
  const entry = createLogEntry({ speakerId: "anya", speakerName: "Anya", text: "Hi", expression: "calm" });
  assert.deepEqual(resolveLogPortrait(entry, iconMap), {
    source: "/icons/anya-calm.svg", scale: 3.8, anchorX: 0.5, anchorY: 0.15,
  });
});

test("resolveLogPortrait returns undefined for narration and missing icons or expression sources", () => {
  assert.equal(resolveLogPortrait(createLogEntry({ text: "Thought" }), iconMap), undefined);
  assert.equal(resolveLogPortrait(createLogEntry({ speakerId: "unknown", expression: "calm" }), iconMap), undefined);
  assert.equal(resolveLogPortrait(createLogEntry({ speakerId: "noa" }), iconMap), undefined);
  assert.equal(resolveLogPortrait(createLogEntry({ speakerId: "noa", expression: "surprised" }), iconMap), undefined);
});

test("renderLogEntries preserves order, text, roles, narration and latest classes", t => {
  withFakeDocument(t);
  const entries = [
    createLogEntry({ speakerId: "noa", speakerName: "Noa", text: "First", expression: "calm" }),
    createLogEntry({ text: "A private thought" }),
    createLogEntry({ speakerId: "anya", speakerName: "Anya", text: "Last", expression: "calm" }),
  ];
  const container = new FakeElement("section");
  const result = renderLogEntries(container, entries, entry => resolveLogPortrait(entry, iconMap));
  assert.equal(result.length, 3);
  assert.deepEqual(container.children, result);
  assert.deepEqual(result.map(article => article.children[1].textContent), ["First", "A private thought", "Last"]);
  assert.ok(result.every(article => article.attributes.role === "listitem"));
  assert.ok(result[1].classes.has("adv-log-entry--narration"));
  assert.equal(result.filter(article => article.classes.has("adv-log-entry--latest")).length, 1);
  assert.ok(result[2].classes.has("adv-log-entry--latest"));
});

test("renderLogEntries adds portrait style values and safely falls back when an image errors", t => {
  withFakeDocument(t);
  const entry = createLogEntry({ speakerId: "noa", speakerName: "<Noa>", text: "<script>safe</script>", expression: "calm" });
  const container = new FakeElement("section");
  const [article] = renderLogEntries(container, [entry], row => resolveLogPortrait(row, iconMap));
  const [header, body] = article.children;
  const [avatar, name] = header.children;
  const image = avatar.children[0];
  assert.equal(name.textContent, "<Noa>");
  assert.equal(body.textContent, "<script>safe</script>");
  assert.equal(image.style.values["--adv-log-portrait-scale"], "2.4");
  assert.equal(image.style.values["--adv-log-portrait-anchor-x"], "0.4");
  assert.equal(image.style.values["--adv-log-portrait-anchor-y"], "0.2");
  image.onerror();
  assert.equal(avatar.removed, true);
  assert.ok(article.classes.has("adv-log-entry--without-icon"));
});

test('demo log framing resolves independently from stage framing for all characters', async () => {
  const { assetManifest } = await import('../examples/asternihva/asset-manifest.mjs');
  assert.deepEqual(assetManifest.map(({ id, logPortrait }) => [id, logPortrait.scale, logPortrait.anchorX, logPortrait.anchorY]), [
    ['noah', 3.8, 0.5, 0.175],
    ['seren', 3.85, 0.5, 0.17],
    ['luminal', 3.9, 0.5, 0.18],
  ]);
  for (const character of assetManifest) {
    const portrait = resolveLogPortrait({ speakerId: character.id, expressionId: 'normal' }, {
      [character.id]: { expressions: { normal: '/portrait.png' }, portrait: character.logPortrait },
    });
    assert.deepEqual({ scale: portrait.scale, anchorX: portrait.anchorX, anchorY: portrait.anchorY }, character.logPortrait);
    assert.notDeepEqual(character.logPortrait, character.portrait);
  }
});
