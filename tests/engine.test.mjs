import test from "node:test";
import assert from "node:assert/strict";
import { AdvEngine } from "../dist/index.js";

class FakeStage {
  commands = [];
  active = undefined;
  names = new Map([["a", "Alice"]]);
  getName(id) { return this.names.get(id); }
  async command(command) { this.commands.push(command); }
  setActive(id) { this.active = id; }
  destroy() {}
}

class FakeUi {
  lines = [];
  choice = 0;
  async presentLine(line) { this.lines.push(line); }
  async presentChoice() { return this.choice; }
  setActiveSpeaker() {}
}

test("runs lines and follows a choice branch", async () => {
  const stage = new FakeStage();
  const ui = new FakeUi();
  const game = {
    start: "start",
    characters: [],
    scenes: {
      start: [
        { type: "line", speaker: "a", text: "hello", expression: "smile" },
        { type: "choice", options: [{ text: "go", next: "next", set: { route: "a" } }] },
      ],
      next: [
        { type: "line", text: "done" },
        { type: "end" },
      ],
    },
  };

  const engine = new AdvEngine({ game, stage, ui });
  await engine.run();

  assert.deepEqual(ui.lines.map((line) => line.text), ["hello", "done"]);
  assert.equal(engine.state.route, "a");
  assert.deepEqual(stage.commands[0], {
    character: "a",
    expression: "smile",
    motion: undefined,
    position: undefined,
    show: true,
  });
});

test("snapshot and restore preserve generic state", () => {
  const stage = new FakeStage();
  const ui = new FakeUi();
  const game = { start: "start", characters: [], scenes: { start: [{ type: "end" }] }, initialState: { seen: false } };
  const engine = new AdvEngine({ game, stage, ui });
  const snapshot = engine.snapshot();
  assert.deepEqual(snapshot, { sceneId: "start", nodeIndex: 0, state: { seen: false } });
  engine.restore({ sceneId: "start", nodeIndex: 0, state: { seen: true } });
  assert.equal(engine.state.seen, true);
});
