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
  ends = 0;
  choice = 0;
  async presentLine(line) { this.lines.push(line); }
  async presentChoice() { return this.choice; }
  setActiveSpeaker() {}
  presentEnd() { this.ends += 1; }
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

test("completion clears the speaker, awaits the UI, and is notified once", async () => {
  const stage = new FakeStage();
  const ui = new FakeUi();
  let release;
  ui.presentEnd = () => {
    ui.ends += 1;
    assert.equal(stage.active, undefined);
    assert.equal(engine.ended, true);
    return new Promise((resolve) => { release = resolve; });
  };
  const game = { start: "start", characters: [], scenes: { start: [
    { type: "line", speaker: "a", text: "last" }, { type: "end" },
  ] } };
  const engine = new AdvEngine({ game, stage, ui });
  const run = engine.run();
  let resolved = false;
  run.then(() => { resolved = true; });
  while (!release) await Promise.resolve();
  assert.equal(resolved, false);
  release();
  await run;
  await engine.run();
  assert.equal(ui.ends, 1);
  assert.equal(ui.lines.length, 1);
});

test("scene exhaustion completes and a restored end can be presented again", async () => {
  const ui = new FakeUi();
  const engine = new AdvEngine({
    game: { start: "start", characters: [], scenes: { start: [] } },
    stage: new FakeStage(), ui,
  });
  await engine.run();
  assert.equal(engine.ended, true);
  const snapshot = engine.snapshot();
  await engine.run();
  assert.equal(ui.ends, 1);
  engine.restore(snapshot);
  assert.equal(engine.ended, false);
  await engine.run();
  assert.equal(ui.ends, 2);
});

test("stop does not notify scenario completion", async () => {
  const ui = new FakeUi();
  let release;
  ui.presentLine = () => new Promise((resolve) => { release = resolve; });
  const engine = new AdvEngine({
    game: { start: "start", characters: [], scenes: { start: [
      { type: "line", text: "waiting" }, { type: "end" },
    ] } }, stage: new FakeStage(), ui,
  });
  const run = engine.run();
  while (!release) await Promise.resolve();
  engine.stop();
  release();
  await run;
  assert.equal(engine.ended, false);
  assert.equal(ui.ends, 0);
});
