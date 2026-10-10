import test from "node:test";
import assert from "node:assert/strict";
import { CharacterStage } from "../dist/index.js";

function setup() {
  const states = new Map();
  const renderer = { key: "custom", create(host, definition) {
    const state = { active: false, expressions: [], motions: [], position: "center" };
    states.set(definition.id, state);
    return {
      setActive(active) { state.active = active; },
      setExpression(name) { state.expressions.push(name); },
      playMotion(name) { state.motions.push(name); },
      setPosition(position) { state.position = position; },
      show() {}, hide() {}, destroy() {},
    };
  } };
  const stage = new CharacterStage({}, ["a", "b", "c"].map(id => ({ id, name: id, renderer: "custom" })), [renderer]);
  return { stage, states };
}

test("speaker changes focus exactly one character and narration treats everyone equally", () => {
  const { stage, states } = setup();
  stage.setActive("a");
  assert.deepEqual([...states.values()].map(state => state.active), [true, false, false]);
  stage.setActive("b");
  assert.deepEqual([...states.values()].map(state => state.active), [false, true, false]);
  stage.setActive(undefined);
  assert.deepEqual([...states.values()].map(state => state.active), [false, false, false]);
});

test("focus leaves position, expression and motion state independent", async () => {
  const { stage, states } = setup();
  await stage.command({ character: "a", position: { x: 20, scale: 1.2 }, expression: "smile", motion: "wave" });
  stage.setActive("a");
  stage.setActive("b");
  assert.deepEqual(states.get("a").position, { x: 20, scale: 1.2 });
  assert.deepEqual(states.get("a").expressions, ["smile"]);
  assert.deepEqual(states.get("a").motions, ["wave"]);
  assert.deepEqual(states.get("b").expressions, []);
  assert.deepEqual(states.get("b").motions, []);
});
