import test from "node:test";
import assert from "node:assert/strict";
import { ChapterProgressStore } from "../dist/ui/chapter-progress.js";

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem(key) { this.readKey = key; return value; },
    setItem(key, next) { this.writeKey = key; value = next; },
    read() { return value; },
  };
}

test("starts empty and reports NEW, PLAYED, and CLEAR from chapter-level state", () => {
  const store = new ChapterProgressStore();
  assert.equal(store.getStatus("ep00"), "NEW");
  store.markPlayed("ep00");
  assert.equal(store.getStatus("ep00"), "PLAYED");
  store.markCompleted("ep00");
  assert.equal(store.getStatus("ep00"), "CLEAR");
  assert.deepEqual(store.snapshot(), {
    playedIds: ["ep00"], completedIds: ["ep00"], lastPlayedId: "ep00",
  });
});

test("persists progress under the default key and restores it in a new store", () => {
  const storage = memoryStorage();
  const store = new ChapterProgressStore(storage);
  store.markPlayed("ep00");
  store.markCompleted("ep01");

  assert.equal(storage.writeKey, "adv.chapter-progress");
  assert.deepEqual(JSON.parse(storage.read()), {
    version: 1,
    playedIds: ["ep00", "ep01"],
    completedIds: ["ep01"],
    lastPlayedId: "ep01",
  });
  const restored = new ChapterProgressStore(storage);
  assert.equal(storage.readKey, "adv.chapter-progress");
  assert.deepEqual(restored.snapshot(), store.snapshot());
  assert.equal(restored.getStatus("ep01"), "CLEAR");
});

test("ignores blank IDs and sanitizes malformed fields, duplicates, and completion invariants", () => {
  const storage = memoryStorage(JSON.stringify({
    version: 1,
    playedIds: ["ep00", "ep00", " ", 12],
    completedIds: ["ep01", "ep01", null],
    lastPlayedId: " ep02 ",
    extra: "ignored",
  }));
  const store = new ChapterProgressStore(storage, "custom-key");

  assert.deepEqual(store.snapshot(), {
    playedIds: ["ep00", "ep01", " ep02 "],
    completedIds: ["ep01"],
    lastPlayedId: " ep02 ",
  });
  assert.equal(store.getStatus("ep01"), "CLEAR");
  assert.equal(store.getStatus("ep02"), "NEW");
  store.markPlayed("");
  store.markPlayed(" \t ");
  store.markCompleted(" ");
  assert.deepEqual(store.snapshot().playedIds, ["ep00", "ep01", " ep02 "]);
  store.markPlayed("ep03");
  assert.equal(storage.writeKey, "custom-key");
});

test("malformed JSON and unsupported versions safely produce empty progress", () => {
  for (const value of ["{broken", JSON.stringify({ version: 2, playedIds: ["ep00"] }), "null"]) {
    const store = new ChapterProgressStore(memoryStorage(value));
    assert.deepEqual(store.snapshot(), { playedIds: [], completedIds: [] });
  }
});

test("read and write failures preserve usable in-memory state and snapshots are immutable copies", () => {
  const storage = {
    getItem() { throw new Error("read unavailable"); },
    setItem() { throw new Error("write unavailable"); },
  };
  const store = new ChapterProgressStore(storage);
  const before = store.snapshot();
  store.markPlayed("ep00");
  store.markCompleted("ep01");

  assert.equal(store.getStatus("ep00"), "PLAYED");
  assert.equal(store.getStatus("ep01"), "CLEAR");
  assert.deepEqual(before, { playedIds: [], completedIds: [] });
  assert.equal(Object.isFrozen(store.snapshot()), true);
  assert.equal(Object.isFrozen(store.snapshot().playedIds), true);
  assert.throws(() => store.snapshot().playedIds.push("ep02"), TypeError);
});
