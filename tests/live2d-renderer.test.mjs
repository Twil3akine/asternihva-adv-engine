import test from "node:test";
import assert from "node:assert/strict";
import {
  AdvEngine,
  CharacterStage,
  Live2DRenderer,
} from "../dist/index.js";

const character = {
  id: "live",
  name: "Live",
  renderer: "live2d",
  assets: { model: "model.json" },
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function modelHandle() {
  const calls = [];
  let destroyed = 0;
  const model = {
    show: (...args) => calls.push(["show", ...args]),
    hide: (...args) => calls.push(["hide", ...args]),
    setExpression: (...args) => calls.push(["setExpression", ...args]),
    playMotion: (...args) => calls.push(["playMotion", ...args]),
    setPosition: (...args) => calls.push(["setPosition", ...args]),
    setActive: (...args) => calls.push(["setActive", ...args]),
    destroy: () => { destroyed += 1; },
  };
  return { model, calls, destroyed: () => destroyed };
}

test("Live2D renderer returns a synchronous wrapper and delegates adapter operations", async () => {
  const handle = modelHandle();
  const renderer = new Live2DRenderer({ createModel: () => handle.model });
  const wrapper = renderer.create({}, character);

  assert.equal(renderer.key, "live2d");
  assert.equal(typeof wrapper.show, "function");
  await Promise.all([
    wrapper.show(),
    wrapper.hide(),
    wrapper.setExpression("smile"),
    wrapper.playMotion("wave"),
    wrapper.setPosition({ x: 25, y: 4, scale: 1.2, zIndex: 7 }),
  ]);

  assert.deepEqual(handle.calls, [
    ["show"],
    ["hide"],
    ["setExpression", "smile"],
    ["playMotion", "wave"],
    ["setPosition", { x: 25, y: 4, scale: 1.2, zIndex: 7 }],
  ]);
});

test("async model initialization gates operations and applies the latest active state", async () => {
  const init = deferred();
  const handle = modelHandle();
  let received;
  const renderer = new Live2DRenderer({
    createModel: (host, value) => {
      received = [host, value];
      return init.promise;
    },
  });
  const host = {};
  const wrapper = renderer.create(host, character);
  const shown = wrapper.show();
  wrapper.setActive(true);
  wrapper.setActive(false);

  assert.deepEqual(received, [host, character]);
  assert.deepEqual(handle.calls, []);
  init.resolve(handle.model);
  await shown;

  assert.deepEqual(handle.calls, [["setActive", false], ["show"]]);
  wrapper.setActive(true);
  assert.deepEqual(handle.calls.at(-1), ["setActive", true]);
});

test("destroy is idempotent and suppresses operations waiting for initialization", async () => {
  const init = deferred();
  const handle = modelHandle();
  const wrapper = new Live2DRenderer({ createModel: () => init.promise }).create({}, character);
  const operations = [
    wrapper.show(),
    wrapper.hide(),
    wrapper.setExpression("smile"),
    wrapper.playMotion("wave"),
    wrapper.setPosition("left"),
  ];
  wrapper.setActive(true);
  wrapper.destroy();
  wrapper.destroy();
  init.resolve(handle.model);
  await Promise.all(operations);

  assert.deepEqual(handle.calls, []);
  assert.equal(handle.destroyed(), 1);
  await Promise.all([wrapper.show(), wrapper.hide(), wrapper.setExpression("sad")]);
  wrapper.setActive(false);
  wrapper.destroy();
  assert.deepEqual(handle.calls, []);
  assert.equal(handle.destroyed(), 1);
});

test("destroy immediately destroys an initialized model exactly once", async () => {
  const handle = modelHandle();
  const wrapper = new Live2DRenderer({ createModel: () => handle.model }).create({}, character);
  await wrapper.show();
  wrapper.destroy();
  wrapper.destroy();
  await wrapper.hide();

  assert.deepEqual(handle.calls, [["show"]]);
  assert.equal(handle.destroyed(), 1);
});

test("initialization errors reach async operations without an unhandled rejection", async (t) => {
  const failure = new Error("model load failed");
  const events = [];
  const onUnhandled = (reason) => events.push(reason);
  process.on("unhandledRejection", onUnhandled);
  t.after(() => process.off("unhandledRejection", onUnhandled));

  const wrapper = new Live2DRenderer({
    createModel: () => Promise.reject(failure),
  }).create({}, character);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, []);
  await assert.rejects(wrapper.show(), (error) => error === failure);
  await assert.rejects(wrapper.setExpression("smile"), (error) => error === failure);
});

test("CharacterStage and AdvEngine run Live2D and another renderer in one scene", async () => {
  const live = modelHandle();
  const customCalls = [];
  const customRenderer = {
    key: "custom",
    create(_host, definition) {
      return {
        show: () => customCalls.push(["show", definition.id]),
        hide: () => customCalls.push(["hide", definition.id]),
        setExpression: (name) => customCalls.push(["expression", definition.id, name]),
        playMotion: (name) => customCalls.push(["motion", definition.id, name]),
        setPosition: (position) => customCalls.push(["position", definition.id, position]),
        setActive: (active) => customCalls.push(["active", definition.id, active]),
        destroy: () => customCalls.push(["destroy", definition.id]),
      };
    },
  };
  const stage = new CharacterStage(
    {},
    [character, { id: "other", name: "Other", renderer: "custom" }],
    [new Live2DRenderer({ createModel: () => live.model }), customRenderer],
  );
  const ui = {
    presentLine: async () => {},
    presentChoice: async () => 0,
    presentEnd: async () => {},
  };
  const engine = new AdvEngine({
    stage,
    ui,
    game: {
      start: "main",
      characters: [character, { id: "other", name: "Other", renderer: "custom" }],
      scenes: {
        main: [
          {
            type: "line",
            speaker: "live",
            text: "hello",
            expression: "smile",
            motion: "wave",
            position: "center",
            commands: [{ character: "other", show: true, expression: "bright" }],
          },
          { type: "end" },
        ],
      },
    },
  });

  await engine.run();

  assert.deepEqual(live.calls, [
    ["setPosition", "center"],
    ["setExpression", "smile"],
    ["show"],
    ["playMotion", "wave"],
    ["setActive", true],
    ["setActive", false],
  ]);
  assert.deepEqual(customCalls, [
    ["expression", "other", "bright"],
    ["show", "other"],
    ["active", "other", false],
    ["active", "other", false],
  ]);
  engine.destroy();
  assert.equal(live.destroyed(), 1);
});
