import type { AudioController } from "./audio.js";
import { SaveError, SaveStore, validateSaveState, isScalarState, type SaveState } from "./save.js";
import { CharacterStage } from "./character-stage.js";
import type {
  AdvNode,
  BackgroundDefinition,
  CharacterCommand,
  EngineSnapshot,
  GameDefinition,
  Scalar,
  UiAdapter,
} from "./types.js";

export interface AdvEngineOptions {
  game: GameDefinition;
  stage: CharacterStage;
  ui: UiAdapter;
  /** Guard unchecked automatic loops; line/choice nodes reset the count. */
  maxAutomaticSteps?: number;
  saves?: SaveStore;
  audio?: AudioController;
  autosave?: boolean;
  onAutosaveError?: (error: unknown) => void;
  progress?: { markPlayed(id: string): void; markCompleted(id: string): void };

}

export class AdvEngine {
  readonly #game: GameDefinition;
  readonly #stage: CharacterStage;
  readonly #ui: UiAdapter;
  readonly #state: Record<string, Scalar>;
  readonly #maxAutomaticSteps: number;

  #sceneId: string;
  #nodeIndex = 0;
  #running = false;
  #ended = false;
  #destroyed = false;
  readonly #options: AdvEngineOptions;
  #background?: string;
  #layout?: string;
  #safe = true;
  #loading = false;
  #epoch = 0;
  #task?: Promise<void>;
  #inFlight = false;
  #cancel?: () => void;
  #cancelled?: Promise<void>;


  constructor(options: AdvEngineOptions) {
    this.#maxAutomaticSteps = options.maxAutomaticSteps ?? 10000;
    if (!Number.isSafeInteger(this.#maxAutomaticSteps) || this.#maxAutomaticSteps < 1) throw new TypeError("maxAutomaticSteps must be a positive integer.");
    this.#options = options;
    this.#game = options.game;
    this.#stage = options.stage;
    this.#ui = options.ui;
    this.#sceneId = options.game.start;
    this.#state = Object.assign(Object.create(null), options.game.initialState);
    this.#ui.setTitle?.(options.game.title);
    this.#ui.setScenarioMetadata?.(options.game.scenario);
  }

  get state(): Readonly<Record<string, Scalar>> {
    return this.#state;
  }

  get ended(): boolean {
    return this.#ended;
  }

  snapshot(): EngineSnapshot {
    return {
      sceneId: this.#sceneId,
      nodeIndex: this.#nodeIndex,
      state: { ...this.#state },
    };
  }

  restore(snapshot: EngineSnapshot): void {
    if (this.#inFlight || this.#loading || this.#destroyed) throw new SaveError("busy", "Stop and settle playback before restoring a legacy snapshot.");
    if (!isScalarState(snapshot.state) || !Number.isSafeInteger(snapshot.nodeIndex) || snapshot.nodeIndex < 0) throw new SaveError("corrupted", "Invalid runtime snapshot.");
    if (!Object.hasOwn(this.#game.scenes, snapshot.sceneId)) {
      throw new Error(`Cannot restore unknown scene: ${snapshot.sceneId}`);
    }

    this.#sceneId = snapshot.sceneId;
    this.#nodeIndex = snapshot.nodeIndex;
    for (const key of Object.keys(this.#state)) delete this.#state[key];
    Object.assign(this.#state, snapshot.state);
    this.#ended = false;
  }

  createSaveState(): SaveState {
    if (!this.#safe || this.#loading || this.#destroyed) throw new SaveError("busy", "Wait for a logical checkpoint before saving.");
    const scenarioId = this.#game.scenario?.id;
    if (!scenarioId) throw new SaveError("scenario-missing", "A stable scenario ID is required to save.");
    return { version: 1, scenarioId, runtime: this.snapshot(), ended: this.#ended,
      ...(this.#options.audio ? { audio: this.#options.audio.snapshot() } : {}),
      presentation: { background: this.#background, layout: this.#layout, characters: this.#stage.snapshot() } };
  }

  #saves(): SaveStore {
    if (!this.#options.saves) throw new SaveError("storage", "No save storage was configured.");
    return this.#options.saves;
  }
  save(slot: string) { return this.#saves().save(slot, this.createSaveState()); }
  deleteSave(slot: string) { return this.#saves().deleteSave(slot); }
  listSaves() { return this.#saves().listSaves(); }
  hasSave(slot: string) { return this.#saves().hasSave(slot); }
  async load(slot: string): Promise<void> {
    const entry = await this.#saves().load(slot);
    await this.restoreSaveState(entry.state);
  }

  /** Stops the old run and reconstructs presentation. Call run() to resume input. */
  async restoreSaveState(state: SaveState): Promise<void> {
    validateSaveState(state);
    if (this.#loading || this.#destroyed) throw new SaveError("busy", "The engine cannot start a load now.");
    if (state.scenarioId !== this.#game.scenario?.id) throw new SaveError("scenario-missing", "Load this save through its scenario catalog entry.");
    if (!Object.hasOwn(this.#game.scenes, state.runtime.sceneId)) throw new SaveError("corrupted", "Saved scene is unavailable.");
    const ids = new Set(this.#game.characters.map(c => c.id));
    if (state.presentation.characters.length !== ids.size || state.presentation.characters.some(c => !ids.has(c.character)) ||
      (state.presentation.layout && !Object.hasOwn(this.#game.stageLayouts ?? {}, state.presentation.layout))) throw new SaveError("corrupted", "Saved presentation is incompatible with this scenario.");
    for (const saved of state.presentation.characters) {
      const definition = this.#game.characters.find(character => character.id === saved.character)!;
      const expressions = definition.assets?.expressions;
      if (saved.expression && expressions && typeof expressions === "object" && !Object.hasOwn(expressions, saved.expression)) throw new SaveError("corrupted", "Saved expression is unavailable.");
    }
    if (state.audio?.bgm && this.#game.audioAssets && !Object.hasOwn(this.#game.audioAssets, state.audio.bgm.id)) throw new SaveError("corrupted", "Saved BGM is unavailable.");
    const copy = structuredClone(state);
    this.#loading = true;
    this.#safe = false;
    this.stop();
    const epoch = this.#epoch;
    const active = () => {
      if (this.#destroyed || epoch !== this.#epoch) throw new SaveError("busy", "Save restoration was cancelled.");
    };
    try {
      // Renderer transitions settle before the saved presentation is applied.
      // A failed old run does not prevent loading a known-good checkpoint.
      await this.#task?.catch(() => {});
      active();
      await this.#options.audio?.restore(copy.audio);
      active();
      await this.#stage.restore(copy.presentation.characters);
      active();
      await this.#setBackground(copy.presentation.background);
      active();
      this.#layout = copy.presentation.layout;
      this.#sceneId = copy.runtime.sceneId;
      this.#nodeIndex = copy.runtime.nodeIndex;
      for (const key of Object.keys(this.#state)) delete this.#state[key];
      Object.assign(this.#state, copy.runtime.state);
      this.#ended = copy.ended;
      this.#ui.setActiveSpeaker?.(undefined);
      if (copy.ended) await this.#ui.presentEnd();
      active();
      this.#safe = true;
      this.#options.progress?.markPlayed(copy.scenarioId);
    } finally { this.#loading = false; }
  }

  run(): Promise<void> {
    if (this.#destroyed) return Promise.reject(new Error("Engine is destroyed."));
    if (this.#inFlight || this.#ended || this.#loading) return this.#task ?? Promise.resolve();
    this.#running = true;
    this.#inFlight = true;
    const epoch = ++this.#epoch;
    this.#cancelled = new Promise(resolve => { this.#cancel = resolve; });
    if (this.#game.scenario?.id) this.#options.progress?.markPlayed(this.#game.scenario.id);
    this.#task = this.#run(epoch);
    return this.#task;
  }

  async #run(epoch: number): Promise<void> {
    let automaticSteps = 0;
    try {
      while (this.#running && epoch === this.#epoch) {
        const scene = Object.hasOwn(this.#game.scenes, this.#sceneId) ? this.#game.scenes[this.#sceneId] : undefined;
        if (!scene) throw new Error(`Unknown scene: ${this.#sceneId}`);
        const node = scene[this.#nodeIndex];
        if (!node) { await this.#finish(); return; }
        this.#safe = false;
        if (node.type === "line" || node.type === "choice") automaticSteps = 0;
        else if (++automaticSteps > this.#maxAutomaticSteps) throw new Error("Maximum automatic steps exceeded; check scenario for a deterministic loop.");
        this.#prefetchNextBackground();
        await this.#execute(node, epoch);
        this.#safe = true;
        if (node.type === "scene" || node.type === "choice") await this.#checkpoint();
      }
    } catch (error) { if (!(error instanceof CancelledExecution)) throw error; }
    finally { this.#inFlight = false; if (epoch === this.#epoch) this.#running = false; }
  }

  async #effect(operation: () => void | Promise<void>, epoch: number): Promise<void> {
    if (epoch !== this.#epoch) throw new CancelledExecution();
    await operation();
    if (epoch !== this.#epoch) throw new CancelledExecution();
  }
  async #interaction<T>(operation: () => Promise<T>, epoch: number): Promise<T> {
    if (epoch !== this.#epoch) throw new CancelledExecution();
    this.#safe = true;
    const result = await Promise.race([operation(), this.#cancelled!.then(() => { throw new CancelledExecution(); })]);
    if (epoch !== this.#epoch) throw new CancelledExecution();
    this.#safe = false;
    return result;
  }
  async #checkpoint(): Promise<void> {
    if (!this.#options.autosave || !this.#options.saves) return;
    try { await this.save("autosave"); } catch (error) { this.#options.onAutosaveError?.(error); }
  }
  stop(): void {
    this.#running = false;
    this.#epoch++;
    this.#cancel?.();
    this.#ui.cancelPending?.();
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.stop();
    this.#stage.destroy();
    this.#ui.destroy?.();
    this.#options.audio?.destroy();
  }

  async #execute(node: AdvNode, epoch: number): Promise<void> {
    switch (node.type) {
      case "audio": {
        const audio = this.#options.audio;
        if (!audio) throw new Error("Audio system is not configured.");
        await this.#effect(() => node.id ? audio.play(node.channel, node.id, node) : audio.stop(node.channel, node), epoch);
        if (node.next) this.#jump(node.next); else this.#nodeIndex++;
        return;
      }
      case "line": {
        if (this.#options.audio) {
          await this.#effect(() => this.#options.audio!.lineChanged(), epoch);
          if (node.voice) await this.#effect(() => this.#options.audio!.play("voice", node.voice!), epoch);
        } else if (node.voice) throw new Error("Audio system is not configured.");
        await this.#effect(() => this.#applyLayout(node.layout), epoch);
        const commands: CharacterCommand[] = [...(node.commands ?? [])];
        if (node.speaker && (node.expression || node.motion || node.position)) {
          commands.push({
            character: node.speaker,
            expression: node.expression,
            motion: node.motion,
            position: node.position,
            show: true,
          });
        }

        await this.#effect(() => this.#runCommands(commands), epoch);
        this.#stage.setActive(node.speaker);
        this.#ui.setActiveSpeaker?.(node.speaker);
        await this.#interaction(() => this.#ui.presentLine({
          speakerId: node.speaker,
          speakerName: node.speaker ? this.#stage.getName(node.speaker) : undefined,
          text: node.text,
          expression: node.speaker ? this.#stage.getExpression?.(node.speaker) : undefined,
        }), epoch);

        if (node.next) {
          this.#jump(node.next);
        } else {
          this.#nodeIndex += 1;
        }
        return;
      }

      case "choice": {
        this.#stage.setActive(undefined);
        this.#ui.setActiveSpeaker?.(undefined);
        const selected = await this.#interaction(() => this.#ui.presentChoice({
          prompt: node.prompt,
          options: node.options.map((option) => option.text),
        }), epoch);
        const option = node.options[selected];
        if (!option) throw new Error(`Invalid choice index: ${selected}`);
        Object.assign(this.#state, option.set ?? {});
        this.#jump(option.next);
        return;
      }

      case "jump":
        this.#jump(node.next);
        return;

      case "set":
        Object.assign(this.#state, node.values);
        if (node.next) this.#jump(node.next);
        else this.#nodeIndex += 1;
        return;

      case "scene":
        await this.#effect(() => this.#setBackground(node.background), epoch);
        await this.#effect(() => this.#applyLayout(node.layout), epoch);
        await this.#effect(() => this.#runCommands(node.commands ?? []), epoch);
        if (node.next) this.#jump(node.next);
        else this.#nodeIndex += 1;
        return;

      case "end":
        await this.#finish();
        return;
    }
  }

  #prefetchNextBackground(): void {
    if (!this.#ui.prefetchBackground || this.#game.scenes[this.#sceneId]?.[this.#nodeIndex]?.type !== "line") return;
    const nearby = this.#game.scenes[this.#sceneId]!.slice(this.#nodeIndex + 1, this.#nodeIndex + 6);
    for (const node of nearby) {
      if (node.type === "choice" || node.type === "jump" || node.type === "end") break;
      if (node.type === "scene" && node.background) {
        const definition = this.#game.backgrounds?.[node.background] ?? { src: node.background };
        void Promise.resolve(this.#ui.prefetchBackground(definition)).catch(() => {});
        break;
      }
      if ("next" in node && node.next) break;
    }
  }

  async #setBackground(idOrSource?: string): Promise<void> {
    const definition: BackgroundDefinition | undefined = idOrSource
      ? this.#game.backgrounds?.[idOrSource] ?? { src: idOrSource }
      : undefined;
    this.#background = idOrSource;
    if (this.#ui.presentBackground) await this.#ui.presentBackground(definition);
    else await this.#ui.setBackground?.(definition?.src);
  }

  async #applyLayout(id?: string): Promise<void> {
    if (!id) return;
    const layout = this.#game.stageLayouts?.[id];
    if (!layout) throw new Error(`Unknown stage layout: ${id}`);
    await this.#stage.applyLayout(layout);
    this.#layout = id;
  }

  async #finish(): Promise<void> {
    this.#ended = true;
    if (this.#game.scenario?.id) this.#options.progress?.markCompleted(this.#game.scenario.id);
    this.#stage.setActive(undefined);
    this.#ui.setActiveSpeaker?.(undefined);
    await this.#ui.presentEnd();
    this.#running = false;
  }

  async #runCommands(commands: readonly CharacterCommand[]): Promise<void> {
    for (const command of commands) {
      await this.#stage.command(command);
    }
  }

  #jump(target: string): void {
    const hashIndex = target.indexOf("#");
    const sceneId = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
    const indexText = hashIndex >= 0 ? target.slice(hashIndex + 1) : "0";
    const nodeIndex = Number(indexText);

    if (!Object.hasOwn(this.#game.scenes, sceneId)) {
      throw new Error(`Unknown jump target scene: ${sceneId}`);
    }
    if (!Number.isInteger(nodeIndex) || nodeIndex < 0) {
      throw new Error(`Invalid jump target index: ${target}`);
    }

    this.#sceneId = sceneId;
    this.#nodeIndex = nodeIndex;
  }
}

class CancelledExecution extends Error {}
