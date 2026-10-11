import assert from "node:assert/strict";
import { AdvEngine, CharacterStage, ScenarioCatalog } from "../dist/core.js";
import * as core from "../dist/core.js";
const game = { scenario: { id: "sample" }, start: "scene-a", characters: [], scenes: { "scene-a": [
  { type: "set", values: { seen: true } }, { type: "line", text: "hello" }, { type: "end" },
] } };
const lines = [], engine = new AdvEngine({ game, stage: new CharacterStage({}, [], []), ui: { presentLine: async line => { lines.push(line.text); }, presentChoice: async () => 0, presentEnd() {} } });
await engine.run(); assert.equal(engine.state.seen, true); assert.deepEqual(lines, ["hello"]); assert.equal(engine.ended, true);
assert.equal(new ScenarioCatalog([{id:"sample",entry:game}]).getScenarios().length,1);
if (core.SaveStore) { const data=new Map(); const saves=new core.SaveStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},"smoke"); await saves.save("quicksave",engine.createSaveState()); assert.equal((await saves.load("quicksave")).state.ended,true); }
console.log(`Runtime smoke passed: ${process.versions.bun ? "Bun " + process.versions.bun : "Node " + process.versions.node}`);
