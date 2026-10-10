import { AdvEngine, type AdvEngineOptions } from "./engine.js";
import type { GameDefinition, ScenarioMetadata } from "./types.js";

export interface ScenarioCatalogMetadata extends ScenarioMetadata {
  id: string;
  description?: string;
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
    return Array.from(this.#entries.keys(), id => this.getScenarioMetadata(id)!);
  }

  getScenarioMetadata(id: string): Readonly<ScenarioCatalogMetadata> | undefined {
    const item = this.#entries.get(id);
    if (!item) return undefined;
    return Object.freeze({
      id: item.id,
      chapter: item.chapter ?? item.entry.scenario?.chapter,
      title: item.title ?? item.entry.scenario?.title,
      description: item.description,
    });
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
    return { engine, finished: engine.run() };
  }
}
