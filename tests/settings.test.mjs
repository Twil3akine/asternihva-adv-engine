import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_SPEED_MULTIPLIERS,
  DEFAULT_GAME_SETTINGS,
  GameSettingsStore,
  getAutoDelayMultiplier,
} from "../dist/ui/settings.js";

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem() { return value; },
    setItem(_key, next) { value = next; },
    read() { return value; },
  };
}

test("settings begin with frozen defaults and expose AUTO speed multipliers", () => {
  const store = new GameSettingsStore();

  assert.deepEqual(store.value, {
    autoSpeed: "normal",
    characterMotion: true,
    uiAnimation: true,
  });
  assert.equal(Object.isFrozen(DEFAULT_GAME_SETTINGS), true);
  assert.equal(Object.isFrozen(store.value), true);
  assert.deepEqual(AUTO_SPEED_MULTIPLIERS, { slow: 1.3, normal: 1, fast: 0.7 });
  assert.equal(getAutoDelayMultiplier(store.value), 1);
  assert.equal(getAutoDelayMultiplier({ ...store.value, autoSpeed: "slow" }), 1.3);
  assert.equal(getAutoDelayMultiplier({ ...store.value, autoSpeed: "fast" }), 0.7);
});

test("updates validate values, notify subscribers, and persist versioned settings", () => {
  const storage = memoryStorage();
  const store = new GameSettingsStore(storage);
  const notifications = [];
  const unsubscribe = store.subscribe(settings => notifications.push(settings));

  const updated = store.update({ autoSpeed: "fast", uiAnimation: false });

  assert.deepEqual(updated, {
    autoSpeed: "fast",
    characterMotion: true,
    uiAnimation: false,
  });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0], updated);
  assert.deepEqual(JSON.parse(storage.read()), {
    version: 1,
    settings: updated,
  });

  unsubscribe();
  store.update({ characterMotion: false });
  assert.equal(notifications.length, 1);
  assert.throws(() => store.update({ characterMotion: "off" }), /invalid value/);
  assert.throws(() => store.update({ unsupported: true }), /unsupported setting/);
});

test("a new store restores a valid saved settings envelope", () => {
  const storage = memoryStorage();
  new GameSettingsStore(storage).update({ autoSpeed: "slow", characterMotion: false });

  const restored = new GameSettingsStore(storage);

  assert.deepEqual(restored.value, {
    autoSpeed: "slow",
    characterMotion: false,
    uiAnimation: true,
  });
  assert.equal(Object.isFrozen(restored.value), true);
});

test("invalid saved data falls back to defaults", () => {
  const invalidValues = [
    "{not json",
    JSON.stringify({ version: 2, settings: DEFAULT_GAME_SETTINGS }),
    JSON.stringify({ version: 1, settings: { ...DEFAULT_GAME_SETTINGS, uiAnimation: "off" } }),
    JSON.stringify({ version: 1, settings: { autoSpeed: "normal", characterMotion: true } }),
  ];

  for (const invalid of invalidValues) {
    assert.deepEqual(new GameSettingsStore(memoryStorage(invalid)).value, DEFAULT_GAME_SETTINGS);
  }
});

test("storage read and write failures do not prevent using settings", () => {
  const storage = {
    getItem() { throw new Error("read unavailable"); },
    setItem() { throw new Error("write unavailable"); },
  };
  const store = new GameSettingsStore(storage);

  assert.deepEqual(store.value, DEFAULT_GAME_SETTINGS);
  assert.doesNotThrow(() => store.update({ autoSpeed: "fast" }));
  assert.equal(store.value.autoSpeed, "fast");
});

test('motion OFF stops active renderer motion and suppresses commands until enabled', async () => {
  const { CharacterStage } = await import('../dist/index.js');
  let motions = 0, stopped = 0;
  const renderer = { key: 'custom', create() { return { playMotion() { motions++; }, stopMotion() { stopped++; } }; } };
  const stage = new CharacterStage({}, [{ id: 'a', name: 'A', renderer: 'custom' }], [renderer]);
  await stage.command({ character: 'a', motion: 'custom-motion' });
  stage.setMotionEnabled(false); await stage.command({ character: 'a', motion: 'custom-motion' });
  assert.equal(motions, 1); assert.equal(stopped, 1);
  stage.setMotionEnabled(true); await stage.command({ character: 'a', motion: 'custom-motion' }); assert.equal(motions, 2);
});
test('UI animation setting stays independent from character motion and updates presentation state', async () => {
  const { DomUi } = await import('../dist/index.js');
  const root = { dataset: {} }, ui = new DomUi({ root });
  ui.setAnimationsEnabled(false); assert.equal(root.dataset.uiAnimation, 'off');
  ui.setAnimationsEnabled(true); assert.equal(root.dataset.uiAnimation, 'on');
});
