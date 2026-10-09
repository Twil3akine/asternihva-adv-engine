import test from "node:test";
import assert from "node:assert/strict";
import { AdvEngine, CharacterStage, SpriteRenderer } from "../dist/index.js";

class Style {
  setProperty() {}
  removeProperty() {}
}

class Element {
  dataset = {};
  style = new Style();
  children = [];
  animations = [];

  append(child) { this.children.push(child); }
  remove() {}
  animate(keyframes, options) {
    let resolveFinished;
    const animation = {
      keyframes,
      options,
      cancelCalls: 0,
      finished: new Promise((resolve) => { resolveFinished = resolve; }),
      cancel() {
        this.cancelCalls += 1;
        resolveFinished();
      },
      finish() { resolveFinished(); },
    };
    this.animations.push(animation);
    return animation;
  }
}

class ImageElement extends Element {
  set src(value) { this.source = value; }
  get src() { return this.source; }
  decode() { return Promise.resolve(); }
}

function setup(t, definitions = [{
  id: "a",
  name: "Alice",
  renderer: "sprite",
  assets: {
    default: "alice.svg",
    motions: {
      wave: {
        keyframes: [{ translate: "0 0" }, { translate: "0 -12px", rotate: "5deg" }],
        duration: 800,
        easing: "ease-in-out",
        iterations: 2,
        direction: "alternate",
      },
      blink: { keyframes: [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }] },
    },
  },
}]) {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tag) => tag === "img" ? new ImageElement() : new Element(),
  };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });

  const host = new Element();
  const renderer = new SpriteRenderer();
  const characters = definitions.map((definition) => renderer.create(host, definition));
  return {
    host,
    characters,
    visual: (index = 0) => host.children[index].children[0],
  };
}

test("sprite motions use the visual wrapper, configured options, and fill none", async (t) => {
  const { characters, visual } = setup(t);
  await characters[0].show();
  const result = characters[0].playMotion("wave");
  const [animation] = visual().animations;

  assert.equal(result, undefined);
  assert.deepEqual(animation.keyframes, [
    { translate: "0 0" },
    { translate: "0 -12px", rotate: "5deg" },
  ]);
  assert.deepEqual(animation.options, {
    duration: 800,
    easing: "ease-in-out",
    iterations: 2,
    direction: "alternate",
    fill: "none",
  });
  assert.deepEqual(visual().children[0].src, "alice.svg");
});

test("sprite motions default to 500ms and a newer valid motion cancels the previous one", (t) => {
  const { characters, visual } = setup(t);
  characters[0].playMotion("blink");
  const [first] = visual().animations;
  assert.equal(first.options.duration, 500);
  assert.equal(first.options.fill, "none");

  characters[0].playMotion("wave");
  const [, second] = visual().animations;
  assert.equal(first.cancelCalls, 1);
  assert.equal(second.options.fill, "none");

  second.finish();
  return second.finished.then(() => new Promise((resolve) => setImmediate(resolve))).then(() => {
    assert.equal(second.cancelCalls, 1);
  });
});

test("unknown motions and commands with undefined motion leave the current animation alone", async (t) => {
  const { host, characters, visual } = setup(t);
  characters[0].playMotion("wave");
  const [animation] = visual().animations;

  characters[0].playMotion("missing");
  characters[0].playMotion(undefined);
  assert.equal(visual().animations.length, 1);
  assert.equal(animation.cancelCalls, 0);

  const definition = {
    id: "stage-character",
    name: "Stage Character",
    renderer: "sprite",
    assets: { default: "stage.svg", motions: { wave: { keyframes: [{ opacity: 1 }, { opacity: 0.5 }] } } },
  };
  const stage = new CharacterStage(host, [definition], [new SpriteRenderer()]);
  await stage.command({ character: definition.id, motion: "wave" });
  const stageAnimation = host.children[1].children[0].animations[0];
  await stage.command({ character: definition.id, motion: undefined });
  assert.equal(host.children[1].children[0].animations.length, 1);
  assert.equal(stageAnimation.cancelCalls, 0);
  stage.destroy();
});

test("motions on separate characters complete independently and destroy cancels", async (t) => {
  const definition = (id) => ({
    id,
    name: id,
    renderer: "sprite",
    assets: { default: `${id}.svg`, motions: { wave: { keyframes: [{ opacity: 1 }, { opacity: 0.5 }] } } },
  });
  const { characters, visual } = setup(t, [definition("a"), definition("b")]);
  characters[0].playMotion("wave");
  characters[1].playMotion("wave");
  const [a] = visual(0).animations;
  const [b] = visual(1).animations;

  a.finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(a.cancelCalls, 1);
  assert.equal(b.cancelCalls, 0);

  characters[1].destroy();
  assert.equal(b.cancelCalls, 1);
});

test("engine forwards a line motion and does not wait for its animation to finish", async (t) => {
  const definition = {
    id: "a",
    name: "Alice",
    renderer: "sprite",
    assets: {
      default: "alice.svg",
      motions: { wave: { keyframes: [{ translate: "0 0" }, { translate: "0 -8px" }] } },
    },
  };
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tag) => tag === "img" ? new ImageElement() : new Element(),
  };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });

  const host = new Element();
  const stage = new CharacterStage(host, [definition], [new SpriteRenderer()]);
  const ui = {
    lines: [],
    async presentLine(line) { this.lines.push(line); },
    async presentChoice() { return 0; },
    presentEnd() {},
  };
  const engine = new AdvEngine({
    game: {
      start: "start",
      characters: [definition],
      scenes: { start: [{ type: "line", speaker: "a", text: "Hello", motion: "wave" }] },
    },
    stage,
    ui,
  });

  await engine.run();
  const animation = host.children[0].children[0].animations[0];
  assert.ok(animation);
  assert.deepEqual(ui.lines.map((line) => line.text), ["Hello"]);
  assert.equal(animation.cancelCalls, 0);

  await stage.command({ character: "a", motion: undefined });
  assert.equal(host.children[0].children[0].animations.length, 1);
  engine.destroy();
  assert.equal(animation.cancelCalls, 1);
});
