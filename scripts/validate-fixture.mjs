import assert from "node:assert/strict";
import { validateScenarios } from "../dist/tooling/scenario-validator.js";
import { lintScenarioSource } from "../dist/tooling/index.js";
const entry = { id: "sample", title: "Sample", entry: { start: "scene-a", characters: [], scenes: {
  "scene-a": [{ type: "line", text: "hello" }, { type: "choice", options: [{ text: "A", next: "scene-b" }] }],
  "scene-b": [{ type: "end" }],
} } };
const result = validateScenarios([entry]);
assert.equal(result.errors, 0); assert.equal(result.warnings, 0);
const source = await lintScenarioSource(`export default ${JSON.stringify(entry.entry)};`);
assert.equal(source.errors, 0); assert.equal(source.warnings, 0);
console.log("Generic validator fixture passed.");
