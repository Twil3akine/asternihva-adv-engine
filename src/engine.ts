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

  constructor(options: AdvEngineOptions) {
    this.#maxAutomaticSteps = options.maxAutomaticSteps ?? 10000;
    if (!Number.isSafeInteger(this.#maxAutomaticSteps) || this.#maxAutomaticSteps < 1) throw new TypeError("maxAutomaticSteps must be a positive integer.");
    this.#game = options.game;
    this.#stage = options.stage;
    this.#ui = options.ui;
    this.#sceneId = options.game.start;
    this.#state = { ...options.game.initialState };
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
    if (!this.#game.scenes[snapshot.sceneId]) {
      throw new Error(`Cannot restore unknown scene: ${snapshot.sceneId}`);
    }

    this.#sceneId = snapshot.sceneId;
    this.#nodeIndex = snapshot.nodeIndex;
    for (const key of Object.keys(this.#state)) delete this.#state[key];
    Object.assign(this.#state, snapshot.state);
    this.#ended = false;
  }

  async run(): Promise<void> {
    if (this.#running || this.#ended) return;
    this.#running = true;

    try {
      let automaticSteps = 0;
      while (this.#running) {
        const scene = this.#game.scenes[this.#sceneId];
        if (!scene) {
          throw new Error(`Unknown scene: ${this.#sceneId}`);
        }

        const node = scene[this.#nodeIndex];
        if (!node) {
          await this.#finish();
          return;
        }

        if (node.type === "line" || node.type === "choice") automaticSteps = 0;
        else if (++automaticSteps > this.#maxAutomaticSteps) throw new Error("Maximum automatic steps exceeded; check scenario for a deterministic loop.");
        this.#prefetchNextBackground();
        await this.#execute(node);
      }
    } finally {
      this.#running = false;
    }
  }

  stop(): void {
    this.#running = false;
  }

  destroy(): void {
    this.stop();
    this.#stage.destroy();
    this.#ui.destroy?.();
  }

  async #execute(node: AdvNode): Promise<void> {
    switch (node.type) {
      case "line": {
        await this.#applyLayout(node.layout);
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

        await this.#runCommands(commands);
        this.#stage.setActive(node.speaker);
        this.#ui.setActiveSpeaker?.(node.speaker);
        await this.#ui.presentLine({
          speakerId: node.speaker,
          speakerName: node.speaker ? this.#stage.getName(node.speaker) : undefined,
          text: node.text,
          expression: node.speaker ? this.#stage.getExpression?.(node.speaker) : undefined,
        });

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
        const selected = await this.#ui.presentChoice({
          prompt: node.prompt,
          options: node.options.map((option) => option.text),
        });
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
        await this.#setBackground(node.background);
        await this.#applyLayout(node.layout);
        await this.#runCommands(node.commands ?? []);
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
    if (this.#ui.presentBackground) await this.#ui.presentBackground(definition);
    else await this.#ui.setBackground?.(definition?.src);
  }

  async #applyLayout(id?: string): Promise<void> {
    if (!id) return;
    const layout = this.#game.stageLayouts?.[id];
    if (!layout) throw new Error(`Unknown stage layout: ${id}`);
    await this.#stage.applyLayout(layout);
  }

  async #finish(): Promise<void> {
    this.#ended = true;
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

    if (!this.#game.scenes[sceneId]) {
      throw new Error(`Unknown jump target scene: ${sceneId}`);
    }
    if (!Number.isInteger(nodeIndex) || nodeIndex < 0) {
      throw new Error(`Invalid jump target index: ${target}`);
    }

    this.#sceneId = sceneId;
    this.#nodeIndex = nodeIndex;
  }
}
