import assert from "node:assert/strict";
import { validateScenarios } from "../dist/tooling/scenario-validator.js";
const entry = { id: "sample", title: "Sample", entry: { start: "scene-a", characters: [], scenes: {
  "scene-a": [{ type: "line", text: "hello" }, { type: "choice", options: [{ text: "A", next: "scene-b" }] }],
  "scene-b": [{ type: "end" }],
} } };
const result = validateScenarios([entry]);
assert.equal(result.errors, 0); assert.equal(result.warnings, 0);
console.log("Generic validator fixture passed.");
