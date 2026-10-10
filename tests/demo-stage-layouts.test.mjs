import test from "node:test";
import assert from "node:assert/strict";
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
