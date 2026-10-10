import { CharacterStage } from "./character-stage.js";
import type {
  AdvNode,
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
}

export class AdvEngine {
  readonly #game: GameDefinition;
  readonly #stage: CharacterStage;
  readonly #ui: UiAdapter;
  readonly #state: Record<string, Scalar>;

  #sceneId: string;
  #nodeIndex = 0;
  #running = false;
  #ended = false;

  constructor(options: AdvEngineOptions) {
    this.#game = options.game;
    this.#stage = options.stage;
    this.#ui = options.ui;
    this.#sceneId = options.game.start;
    this.#state = { ...options.game.initialState };
    this.#ui.setTitle?.(options.game.title);
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
        await this.#ui.setBackground?.(node.background);
        await this.#runCommands(node.commands ?? []);
        if (node.next) this.#jump(node.next);
        else this.#nodeIndex += 1;
        return;

      case "end":
        await this.#finish();
        return;
    }
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
