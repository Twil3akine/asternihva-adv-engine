import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stageLayoutManifest } from "../examples/asternihva/stage-layout-manifest.mjs";

test("Asternihva demo layout manifest covers trio, duos, solos, and narration", () => {
  assert.deepEqual(Object.keys(stageLayoutManifest), [
    "trio", "duo-noah-seren", "duo-seren-luminal", "solo-noah", "solo-seren-close", "narration", "background-only",
  ]);
  assert.deepEqual(stageLayoutManifest.trio.members.map(member => member.character), ["noah", "seren", "luminal"]);
  assert.equal(stageLayoutManifest["duo-noah-seren"].members.length, 2);
  assert.equal(stageLayoutManifest["duo-seren-luminal"].members.length, 2);
  assert.equal(stageLayoutManifest["solo-noah"].members.length, 1);
  assert.equal(stageLayoutManifest["solo-seren-close"].members[0].position.scale, 1.08);
  assert.equal(stageLayoutManifest.narration.members.length, 3);
  assert.deepEqual(stageLayoutManifest["background-only"], { hideOthers: true, members: [] });
});

test("EP.00 opens on the empty window view, introduces characters solo, and clears the last narration", async () => {
  const main = await readFile(new URL("../examples/asternihva/main.mjs", import.meta.url), "utf8");
  const opening = main.slice(main.indexOf("intro: ["), main.indexOf("\n    noah: ["));
  const ending = main.slice(main.indexOf("\n    end: ["));
  assert.match(opening, /background: firstBackground \?\? "room-night-window",\s*layout: "background-only"/);
  assert.match(opening, /layout: "background-only", text: "窓の外で、小さな光が瞬いた/);
  assert.match(opening, /layout: "solo-noah", speaker: "noah"/);
  assert.match(opening, /layout: "solo-seren-close", speaker: "seren"/);
  assert.match(opening, /layout: "trio", speaker: "luminal"/);
  assert.match(ending, /layout: "background-only", text: "三人の声が、静かな部屋に重なった/);
});
