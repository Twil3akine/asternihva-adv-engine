import test from "node:test";
import assert from "node:assert/strict";
import { AdvEngine, CharacterStage, createStageLayoutPreset } from "../dist/index.js";

test("generic stage layout presets arrange caller-supplied character ids", () => {
  assert.deepEqual(createStageLayoutPreset("trio", ["a", "b", "c"]).members.map(x => x.position.x), [20, 50, 80]);
  assert.deepEqual(createStageLayoutPreset("duo-left", ["a", "b"]).members.map(x => x.position.x), [28, 48]);
  assert.deepEqual(createStageLayoutPreset("duo-right", ["a", "b"]).members.map(x => x.position.x), [52, 72]);
  assert.deepEqual(createStageLayoutPreset("solo-center", ["a"]).members[0].position, { x: 50 });
  assert.deepEqual(createStageLayoutPreset("solo-close", ["a"]).members[0].position, { x: 50, scale: 1.08 });
  assert.deepEqual(createStageLayoutPreset("narration", ["a", "b"]).members.map(x => x.position.x), [35, 65]);
  assert.throws(() => createStageLayoutPreset("trio", ["a"]), /does not support/);
});

test("scene and line layouts show selected characters, hide others, and preserve speaker focus", async () => {
  const states = new Map();
  const renderer = {
    key: "test",
    create(_host, character) {
      const state = { visible: false, expression: "", active: false, position: undefined };
      states.set(character.id, state);
      return {
        async show() { state.visible = true; }, async hide() { state.visible = false; },
        async setExpression(name) { state.expression = name; }, async playMotion() {},
        async setPosition(position) { state.position = position; },
        setActive(active) { state.active = active; }, destroy() {},
      };
    },
  };
  const characters = ["a", "b", "c"].map(id => ({ id, name: id, renderer: "test" }));
  const layouts = {
    trio: createStageLayoutPreset("trio", ["a", "b", "c"]),
    close: createStageLayoutPreset("solo-close", ["a"]),
  };
  const ui = { async presentLine() {}, async presentChoice() { return 0; }, presentEnd() {} };
  const stage = new CharacterStage({}, characters, [renderer]);
  const engine = new AdvEngine({ stage, ui, game: {
    start: "start", characters, stageLayouts: layouts,
    scenes: { start: [
      { type: "scene", layout: "trio" },
      { type: "line", layout: "close", speaker: "a", expression: "smile", text: "Hello" },
      { type: "end" },
    ] },
  } });
  await engine.run();
  assert.equal(states.get("a").visible, true);
  assert.equal(states.get("a").position.x, 50);
  assert.equal(states.get("a").position.scale, 1.08);
  assert.equal(states.get("a").expression, "smile");
  assert.equal(states.get("b").visible, false);
  assert.equal(states.get("c").visible, false);
  assert.equal(states.get("a").active, false, "ending clears speaker focus");
});

test("invalid layout members fail before changing any character", async () => {
  const states = new Map();
  const renderer = { key: "test", create(_host, character) {
    const state = { visible: false, position: undefined }; states.set(character.id, state);
    return { show() { state.visible = true; }, hide() { state.visible = false; }, setExpression() {}, playMotion() {}, setPosition(position) { state.position = position; }, destroy() {} };
  } };
  const stage = new CharacterStage({}, [{ id: "a", name: "A", renderer: "test" }], [renderer]);
  await assert.rejects(stage.applyLayout({ members: [{ character: "missing", position: { x: 50 } }] }), /Unknown character/);
  assert.equal(states.get("a").visible, false);
  assert.equal(states.get("a").position, undefined);
});

test("an empty hide-others layout creates a clean background-only stage", async () => {
  const visibility = new Map();
  const characters = ["a", "b"].map(id => ({ id, name: id, renderer: "test" }));
  const renderer = { key: "test", create(_host, character) {
    return {
      async show() { visibility.set(character.id, true); },
      async hide() { visibility.set(character.id, false); },
      setExpression() {}, playMotion() {}, setPosition() {}, destroy() {},
    };
  } };
  const stage = new CharacterStage({}, characters, [renderer]);
  await stage.applyLayout(createStageLayoutPreset("duo-left", ["a", "b"]));
  assert.equal(visibility.get("a"), true);
  assert.equal(visibility.get("b"), true);
  await stage.applyLayout({ hideOthers: true, members: [] });
  assert.equal(visibility.get("a"), false);
  assert.equal(visibility.get("b"), false);
});
