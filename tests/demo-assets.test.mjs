import test from "node:test";
import assert from "node:assert/strict";
import { assetManifest } from "../examples/asternihva/asset-manifest.mjs";
import { loadDemoAssets } from "../examples/asternihva/demo-assets.mjs";

const ready = {
  version: 1,
  characters: Object.fromEntries(assetManifest.map(character => [character.id,
    Object.fromEntries(Object.entries(character.expressions).map(([id, file]) => [id, `${character.id}/${file}`])),
  ])),
};
const fetchReady = async () => ({ ok: true, json: async () => ready });

test("demo loads all exact local expression paths and portrait settings", async () => {
  const result = await loadDemoAssets(fetchReady, async () => true);
  assert.deepEqual(result.missing, []);
  for (const [index, character] of result.characters.entries()) {
    const definition = assetManifest[index];
    assert.equal(character.local, true);
    assert.equal(character.assets.displayMode, "portrait");
    assert.deepEqual(character.assets.portrait, definition.portrait);
    for (const [id, filename] of Object.entries(definition.expressions)) {
      assert.ok(character.assets.expressions[id].endsWith(`/public/characters/${character.id}/${filename}`));
    }
  }
});

test("demo without a local manifest keeps a usable placeholder scenario", async () => {
  const result = await loadDemoAssets(async () => ({ ok: false }), () => { throw new Error("should not probe"); });
  assert.equal(result.missing.length, 30);
  for (const character of result.characters) {
    assert.equal(character.local, false);
    assert.equal(character.assets.displayMode, "fullbody");
    for (const name of ["normal", "smile", "surprised"]) {
      assert.ok(character.assets.expressions[name].endsWith(".svg"));
    }
  }
});

test("missing local image falls back for one character without changing the others", async () => {
  const result = await loadDemoAssets(fetchReady, async source => !source.endsWith("Seren_neutral.png"));
  assert.deepEqual(result.missing, ["Seren_neutral.png"]);
  assert.deepEqual(result.characters.map(character => character.local), [true, false, true]);
  assert.ok(result.characters[1].assets.expressions.normal.endsWith("seren-normal.svg"));
  assert.ok(result.characters[0].assets.expressions.normal.endsWith("Noah_neutral.png"));
});

test('demo probes only each character initial expression and never decodes unused assets', async () => {
  const probes = [];
  await loadDemoAssets(fetchReady, async source => { probes.push(source.split('/').pop()); return true; });
  assert.deepEqual(probes.sort(), ['Luminal_neutral.png', 'Noah_neutral.png', 'Seren_neutral.png']);
});
