import type { LogicalAudioState } from "./audio.js";
import type { EngineSnapshot, Scalar, StagePosition } from "./types.js";

/** DOM-free storage; implementations may be synchronous or asynchronous. */
export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}
export interface CharacterState {
  character: string;
  visible: boolean;
  expression?: string;
  position: StagePosition;
}
export interface SaveState {
  version: 1;
  scenarioId: string;
  runtime: EngineSnapshot;
  presentation: { background?: string; layout?: string; characters: CharacterState[] };
  ended: boolean;
  audio?: LogicalAudioState;
}
export interface SaveRecord { slot: string; savedAt: string; state: SaveState; }
export interface SaveSummary { slot: string; savedAt: string; scenarioId: string; sceneId: string; nodeIndex: number; }
export type SaveErrorCode = "missing" | "corrupted" | "unsupported-version" | "scenario-missing" | "busy" | "storage" | "invalid-slot";
export class SaveError extends Error {
  constructor(readonly code: SaveErrorCode, message: string, options?: ErrorOptions) { super(message, options); this.name = "SaveError"; }
}
export const DEFAULT_SAVE_SLOTS = Object.freeze(["autosave", "quicksave", "manual-1", "manual-2", "manual-3", "manual-4", "manual-5"]);
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
export function isScalarState(value: unknown): value is Record<string, Scalar> {
  return record(value) && Object.values(value).every(v => v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v)));
}
export function isStagePosition(value: unknown): value is StagePosition {
  return ["far-left", "left", "center", "right", "far-right"].includes(value as string) ||
    (record(value) && typeof value.x === "number" && Number.isFinite(value.x) && ["y", "scale", "zIndex"].every(k => value[k] === undefined || (typeof value[k] === "number" && Number.isFinite(value[k]))));
}
/** Validate untrusted persisted data before any runtime or renderer mutation. */
export function validateSaveState(value: unknown): asserts value is SaveState {
  if (!record(value)) throw new SaveError("corrupted", "Invalid save state.");
  if (value.version !== 1) throw new SaveError("unsupported-version", "Unsupported save schema version.");
  const runtime = value.runtime, presentation = value.presentation;
  if (value.audio !== undefined && (!record(value.audio) || (value.audio.bgm !== undefined &&
    (!record(value.audio.bgm) || !id(value.audio.bgm.id) || typeof value.audio.bgm.loop !== "boolean" ||
      typeof value.audio.bgm.volume !== "number" || !Number.isFinite(value.audio.bgm.volume) || value.audio.bgm.volume < 0 || value.audio.bgm.volume > 1)))) {
    throw new SaveError("corrupted", "Invalid saved audio state.");
  }
  if (!id(value.scenarioId) || typeof value.ended !== "boolean" || !record(runtime) || !id(runtime.sceneId) ||
      !Number.isSafeInteger(runtime.nodeIndex) || (runtime.nodeIndex as number) < 0 || !isScalarState(runtime.state) ||
      !record(presentation) || (presentation.background !== undefined && !id(presentation.background)) ||
      (presentation.layout !== undefined && !id(presentation.layout)) || !Array.isArray(presentation.characters) ||
      !presentation.characters.every(c => record(c) && id(c.character) && typeof c.visible === "boolean" &&
        (c.expression === undefined || id(c.expression)) && isStagePosition(c.position)) ||
      new Set(presentation.characters.map(c => c.character)).size !== presentation.characters.length) {
    throw new SaveError("corrupted", "Invalid save state fields.");
  }
}

/** Fixed slots avoid storage enumeration and exclude renderer caches and story text. */
export class SaveStore {
  readonly slots: readonly string[];
  constructor(readonly storage: StorageAdapter, readonly namespace: string, slots: readonly string[] = DEFAULT_SAVE_SLOTS) {
    if (!id(namespace) || !slots.length || slots.some(s => !id(s)) || new Set(slots).size !== slots.length) throw new TypeError("A namespace and unique save slots are required.");
    this.slots = Object.freeze([...slots]);
  }
  #key(slot: string): string {
    if (!this.slots.includes(slot)) throw new SaveError("invalid-slot", "Unknown save slot.");
    return `${this.namespace}:save:${slot}`;
  }
  async #storage<T>(operation: () => T | Promise<T>): Promise<T> {
    try { return await operation(); } catch (cause) { throw new SaveError("storage", "Save storage is unavailable.", { cause }); }
  }
  async save(slot: string, state: SaveState): Promise<SaveRecord> {
    const key = this.#key(slot);
    validateSaveState(state);
    const entry: SaveRecord = { slot, savedAt: new Date().toISOString(), state: structuredClone(state) };
    await this.#storage(() => this.storage.setItem(key, JSON.stringify(entry)));
    return entry;
  }
  async load(slot: string): Promise<SaveRecord> {
    const key = this.#key(slot);
    const text = await this.#storage(() => this.storage.getItem(key));
    if (text === null) throw new SaveError("missing", "Save slot is empty.");
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new SaveError("corrupted", "Save slot is not valid JSON."); }
    if (!record(value) || value.slot !== slot || typeof value.savedAt !== "string" || !Number.isFinite(Date.parse(value.savedAt))) throw new SaveError("corrupted", "Invalid save envelope.");
    validateSaveState(value.state);
    return value as unknown as SaveRecord;
  }
  async deleteSave(slot: string): Promise<void> { const key = this.#key(slot); await this.#storage(() => this.storage.removeItem(key)); }
  async hasSave(slot: string): Promise<boolean> { const key = this.#key(slot); return (await this.#storage(() => this.storage.getItem(key))) !== null; }
  /** A corrupt slot does not hide the remaining slots; load(slot) reports its exact error. */
  async listSaves(): Promise<SaveSummary[]> {
    const result: SaveSummary[] = [];
    for (const slot of this.slots) {
      try { const { state, savedAt } = await this.load(slot); result.push({ slot, savedAt, scenarioId: state.scenarioId, sceneId: state.runtime.sceneId, nodeIndex: state.runtime.nodeIndex }); }
      catch (error) { if (!(error instanceof SaveError) || !["missing", "corrupted", "unsupported-version"].includes(error.code)) throw error; }
    }
    return result;
  }
}
