import test from "node:test";
import assert from "node:assert/strict";
import { validateScenarios } from "../dist/tooling/scenario-validator.js";

const character = {
  id: "alice",
  name: "Alice",
  renderer: "sprite",
  assets: {
    expressions: { normal: "alice.svg", smile: "alice-smile.svg" },
    motions: { wave: {} },
  },
};

function entry(overrides = {}) {
  const game = {
    start: "intro",
    characters: [character],
    backgrounds: { room: { src: "room.png" } },
    stageLayouts: { solo: { members: [{ character: "alice" }] } },
    scenes: {
      intro: [
        { type: "scene", background: "room", layout: "solo" },
        { type: "line", speaker: "alice", expression: "normal", motion: "wave", text: "Hello.", next: "finish#0" },
      ],
      finish: [{ type: "end" }],
    },
    ...overrides.game,
  };
  return { id: "ep.test", title: "Test", entry: game, ...overrides };
}

function diagnostics(scenarios) {
  return validateScenarios(scenarios).diagnostics;
}

test("accepts a valid scenario, #index targets, and implicit scene exhaustion", () => {
  const result = validateScenarios([entry({ game: {
    ...entry().entry,
    scenes: {
      intro: [
        { type: "line", speaker: "alice", expression: "smile", text: "Hello.", next: "finish#1" },
      ],
      finish: [{ type: "line", text: "Done." }, { type: "end" }],
    },
  } })]);
  assert.deepEqual(result, { diagnostics: [], errors: 0, warnings: 0, valid: true });

  const implicitEnd = validateScenarios([entry({ game: {
    ...entry().entry,
    scenes: { intro: [{ type: "line", text: "The scene ends here." }] },
  } })]);
  assert.equal(implicitEnd.valid, true);
});

test("reports duplicate IDs, missing titles and missing start scenes", () => {
  const invalid = entry({ title: undefined, game: { ...entry().entry, start: "missing" } });
  const result = validateScenarios([invalid, entry()]);
  assert.equal(result.errors, 3);
  assert.match(result.diagnostics.map((item) => item.message).join("\n"), /duplicate scenario id/);
  assert.match(result.diagnostics.map((item) => item.message).join("\n"), /missing scenario title/);
  assert.match(result.diagnostics.map((item) => item.message).join("\n"), /start scene "missing" does not exist/);
});

test("warns when catalog order values repeat", () => {
  const result = validateScenarios([entry({ id: "first", order: 1 }), entry({ id: "second", order: 1 })]);
  assert.equal(result.errors, 0);
  assert.equal(result.warnings, 2);
  assert.ok(result.diagnostics.every((item) => item.message === "duplicate scenario order 1"));
});

test("checks next and choice targets including malformed indices", () => {
  const game = {
    ...entry().entry,
    scenes: {
      intro: [
        { type: "line", text: "next", next: "absent" },
        { type: "choice", options: [{ text: "bad scene", next: "missing#0" }, { text: "bad index", next: "finish#-1" }] },
      ],
      finish: [{ type: "end" }],
    },
  };
  const messages = diagnostics([entry({ game })]).map((item) => item.message);
  assert.ok(messages.some((message) => message.includes('unknown target scene "absent"')));
  assert.ok(messages.some((message) => message.includes('unknown target scene "missing"')));
  assert.ok(messages.some((message) => message.includes('invalid target index in "finish#-1"')));
});

test("checks characters, expressions, motions, backgrounds, layouts and layout members", () => {
  const game = {
    ...entry().entry,
    stageLayouts: { broken: { members: [{ character: "ghost" }] } },
    scenes: {
      intro: [
        { type: "scene", background: "outside", layout: "missing" },
        { type: "line", speaker: "ghost", text: "Unknown speaker." },
        { type: "line", speaker: "alice", expression: "angry", motion: "run", layout: "missing", text: "Unknown assets." },
        { type: "line", commands: [{ character: "ghost", expression: "normal", motion: "wave" }], text: "Bad command." },
      ],
    },
  };
  const messages = diagnostics([entry({ game })]).map((item) => item.message);
  assert.ok(messages.some((message) => message.includes('unknown character "ghost"')));
  assert.ok(messages.some((message) => message.includes('unknown expression "angry"')));
  assert.ok(messages.some((message) => message.includes('unknown motion "run"')));
  assert.ok(messages.some((message) => message.includes('unknown background "outside"')));
  assert.ok(messages.some((message) => message.includes('unknown layout "missing"')));
});

test("warns for unreachable scenes and errors when reachable cycles cannot terminate", () => {
  const game = {
    ...entry().entry,
    scenes: {
      intro: [{ type: "jump", next: "loop" }],
      loop: [{ type: "jump", next: "loop" }],
      unused: [{ type: "end" }],
    },
  };
  const result = validateScenarios([entry({ game })]);
  assert.ok(result.diagnostics.some((item) => item.severity === "warning" && item.message.includes('scene "unused" is unreachable')));
  assert.ok(result.diagnostics.some((item) => item.severity === "error" && item.message.includes("cannot reach scenario termination")));
});

test("accepts a choice when each branch can terminate", () => {
  const game = {
    ...entry().entry,
    scenes: {
      intro: [{ type: "choice", options: [{ text: "A", next: "a" }, { text: "B", next: "b" }] }],
      a: [{ type: "end" }],
      b: [{ type: "line", text: "B path ends at scene exhaustion." }],
    },
  };
  assert.equal(validateScenarios([entry({ game })]).valid, true);
});
