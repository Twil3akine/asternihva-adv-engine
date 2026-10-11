import type { SaveStore } from "./save.js";
import { SaveError } from "./save.js";
import { AdvEngine, type AdvEngineOptions } from "./engine.js";
import type { GameDefinition, ScenarioMetadata } from "./types.js";

export interface ScenarioCatalogMetadata extends ScenarioMetadata {
  id: string;
  description?: string;
  order?: number;
}

export interface ScenarioCatalogEntry extends ScenarioCatalogMetadata {
  entry: GameDefinition;
}

export interface ScenarioPlayback {
  engine: AdvEngine;
  /** Resolves when the scenario finishes; execution errors reject this promise. */
  finished: Promise<void>;
}

/** Ordered scenario definitions. Navigation and presentation remain with the game shell. */
export class ScenarioCatalog {
  #currentId?: string;
  readonly #entries = new Map<string, ScenarioCatalogEntry>();

  constructor(entries: readonly ScenarioCatalogEntry[] = []) {
    for (const item of entries) {
      if (!item.id.trim() || this.#entries.has(item.id)) {
        throw new Error(`Invalid or duplicate scenario id: ${item.id}`);
      }
      this.#entries.set(item.id, { ...item });
    }
  }

  getScenarios(): readonly Readonly<ScenarioCatalogMetadata>[] {
    return Array.from(this.#entries.keys(), id => this.getScenarioMetadata(id)!).sort((a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
      (a.chapter ?? "").localeCompare(b.chapter ?? "", undefined, { numeric: true }));
  }

  getScenarioMetadata(id: string): Readonly<ScenarioCatalogMetadata> | undefined {
    const item = this.#entries.get(id);
    if (!item) return undefined;
    return Object.freeze({
      id: item.id,
      chapter: item.chapter ?? item.entry.scenario?.chapter,
      title: item.title ?? item.entry.scenario?.title,
      description: item.description ?? item.entry.scenario?.description,
      order: item.order ?? item.entry.scenario?.order,
    });
  }

  getScenario(id: string): Readonly<ScenarioCatalogEntry> | undefined {
    const item = this.#entries.get(id);
    return item ? Object.freeze({ ...item, ...this.getScenarioMetadata(id) }) : undefined;
  }

  getCurrentScenario(): Readonly<ScenarioCatalogEntry> | undefined {
    return this.#currentId ? this.getScenario(this.#currentId) : undefined;
  }

  async loadScenario(slot: string, options: Omit<AdvEngineOptions, "game"> & { saves: SaveStore }): Promise<ScenarioPlayback> {
    const record = await options.saves.load(slot);
    const item = this.#entries.get(record.state.scenarioId);
    if (!item) throw new SaveError("scenario-missing", "Saved scenario is not in this catalog.");
    const engine = new AdvEngine({ ...options, game: { ...item.entry, scenario: { ...item.entry.scenario, id: item.id } } });
    await engine.restoreSaveState(record.state);
    this.#currentId = item.id;
    return { engine, finished: engine.run() };
  }

  /** Starts a fresh engine; the caller owns its stage/UI and eventual destruction. */
  startScenario(id: string, options: Omit<AdvEngineOptions, "game">): ScenarioPlayback {
    const item = this.#entries.get(id);
    if (!item) throw new Error(`Unknown scenario: ${id}`);
    const metadata = this.getScenarioMetadata(id)!;
    const engine = new AdvEngine({ ...options, game: {
      ...item.entry,
      scenario: { id, chapter: metadata.chapter, title: metadata.title },
    } });
    this.#currentId = id;
    return { engine, finished: engine.run() };
  }
}
