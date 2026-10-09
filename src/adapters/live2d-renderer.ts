import type {
  CharacterDefinition,
  CharacterRenderer,
  RenderedCharacter,
  StagePosition,
} from "../types.js";

/**
 * A game-owned bridge to its Live2D runtime; no Cubism types are required.
 * playMotion should resolve once playback starts so dialogue can proceed.
 */
export interface Live2DModelAdapter extends RenderedCharacter {}

export interface Live2DRendererOptions {
  createModel(host: HTMLElement, character: CharacterDefinition):
    Live2DModelAdapter | Promise<Live2DModelAdapter>;
}

class Live2DCharacter implements RenderedCharacter {
  readonly #ready: Promise<Live2DModelAdapter>;
  #model?: Live2DModelAdapter;
  #destroyed = false;
  #active?: boolean;

  constructor(model: Live2DModelAdapter | Promise<Live2DModelAdapter>) {
    this.#ready = Promise.resolve(model).then((adapter) => {
      if (this.#destroyed) {
        adapter.destroy();
      } else {
        this.#model = adapter;
        if (this.#active !== undefined) adapter.setActive?.(this.#active);
      }
      return adapter;
    });
    // Initialization may fail before the first command awaits it.
    void this.#ready.catch(() => {});
  }

  async show(): Promise<void> {
    if (this.#destroyed) return;
    const model = await this.#ready;
    if (!this.#destroyed) await model.show();
  }

  async hide(): Promise<void> {
    if (this.#destroyed) return;
    const model = await this.#ready;
    if (!this.#destroyed) await model.hide();
  }

  async setExpression(name: string): Promise<void> {
    if (this.#destroyed) return;
    const model = await this.#ready;
    if (!this.#destroyed) await model.setExpression(name);
  }

  async playMotion(name: string): Promise<void> {
    if (this.#destroyed) return;
    const model = await this.#ready;
    if (!this.#destroyed) await model.playMotion(name);
  }

  async setPosition(position: StagePosition): Promise<void> {
    if (this.#destroyed) return;
    const model = await this.#ready;
    if (!this.#destroyed) await model.setPosition(position);
  }

  setActive(active: boolean): void {
    if (this.#destroyed) return;
    this.#active = active;
    this.#model?.setActive?.(active);
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#model?.destroy();
  }
}

export class Live2DRenderer implements CharacterRenderer {
  readonly key = "live2d";
  readonly #options: Live2DRendererOptions;

  constructor(options: Live2DRendererOptions) {
    this.#options = options;
  }

  create(host: HTMLElement, character: CharacterDefinition): RenderedCharacter {
    return new Live2DCharacter(this.#options.createModel(host, character));
  }
}
