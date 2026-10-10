export interface ChapterProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ChapterProgressStatus = "NEW" | "PLAYED" | "CLEAR";

export interface ChapterProgressSnapshot {
  readonly playedIds: readonly string[];
  readonly completedIds: readonly string[];
  readonly lastPlayedId?: string;
}

interface StoredProgress {
  version: 1;
  playedIds: string[];
  completedIds: string[];
  lastPlayedId?: string;
}

const DEFAULT_STORAGE_KEY = "adv.chapter-progress";

/** Stores chapter-level play history. Scenario node positions are never persisted. */
export class ChapterProgressStore {
  readonly #storage?: ChapterProgressStorage;
  readonly #key: string;
  readonly #playedIds = new Set<string>();
  readonly #completedIds = new Set<string>();
  #lastPlayedId?: string;

  constructor(storage?: ChapterProgressStorage, key = DEFAULT_STORAGE_KEY) {
    this.#storage = storage;
    this.#key = key;
    this.#restore();
  }

  getStatus(scenarioId: string): ChapterProgressStatus {
    if (this.#completedIds.has(scenarioId)) return "CLEAR";
    if (this.#playedIds.has(scenarioId)) return "PLAYED";
    return "NEW";
  }

  markPlayed(scenarioId: string): void {
    if (!isUsableId(scenarioId)) return;
    this.#playedIds.add(scenarioId);
    this.#lastPlayedId = scenarioId;
    this.#persist();
  }

  markCompleted(scenarioId: string): void {
    if (!isUsableId(scenarioId)) return;
    this.#playedIds.add(scenarioId);
    this.#completedIds.add(scenarioId);
    this.#lastPlayedId = scenarioId;
    this.#persist();
  }

  snapshot(): ChapterProgressSnapshot {
    const playedIds = Object.freeze([...this.#playedIds]);
    const completedIds = Object.freeze([...this.#completedIds]);
    return Object.freeze({
      playedIds,
      completedIds,
      ...(this.#lastPlayedId === undefined ? {} : { lastPlayedId: this.#lastPlayedId }),
    });
  }

  #restore(): void {
    try {
      const stored = this.#storage?.getItem(this.#key);
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (!isRecord(parsed) || parsed.version !== 1) return;

      for (const id of readIds(parsed.playedIds)) this.#playedIds.add(id);
      for (const id of readIds(parsed.completedIds)) {
        this.#completedIds.add(id);
        this.#playedIds.add(id);
      }
      if (isUsableId(parsed.lastPlayedId)) {
        this.#lastPlayedId = parsed.lastPlayedId;
        this.#playedIds.add(parsed.lastPlayedId);
      }
    } catch {
      // Storage may be unavailable or contain invalid JSON; use an empty session state.
    }
  }

  #persist(): void {
    try {
      const state: StoredProgress = {
        version: 1,
        playedIds: [...this.#playedIds],
        completedIds: [...this.#completedIds],
        ...(this.#lastPlayedId === undefined ? {} : { lastPlayedId: this.#lastPlayedId }),
      };
      this.#storage?.setItem(this.#key, JSON.stringify(state));
    } catch {
      // Keep the updated in-memory state when storage cannot be written.
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUsableId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isUsableId))];
}
