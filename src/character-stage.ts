import type {
  CharacterCommand,
  CharacterDefinition,
  CharacterRenderer,
  RenderedCharacter,
} from "./types.js";

interface CharacterEntry {
  definition: CharacterDefinition;
  instance: RenderedCharacter;
  expression?: string;
}

export class CharacterStage {
  #motionEnabled = true;
  readonly #characters = new Map<string, CharacterEntry>();

  constructor(
    host: HTMLElement,
    characters: readonly CharacterDefinition[],
    renderers: readonly CharacterRenderer[],
  ) {
    const rendererMap = new Map(renderers.map((renderer) => [renderer.key, renderer]));

    for (const character of characters) {
      const renderer = rendererMap.get(character.renderer);
      if (!renderer) {
        throw new Error(
          `Renderer \"${character.renderer}\" for character \"${character.id}\" is not registered.`,
        );
      }

      const instance = renderer.create(host, character);
      this.#characters.set(character.id, { definition: character, instance, expression: character.defaultExpression });
    }
  }

  setMotionEnabled(enabled: boolean): void {
    this.#motionEnabled = enabled;
    if (!enabled) for (const entry of this.#characters.values()) entry.instance.stopMotion?.();
  }

  getName(characterId: string): string | undefined {
    return this.#characters.get(characterId)?.definition.name;
  }

  getExpression(characterId: string): string | undefined {
    return this.#characters.get(characterId)?.expression;
  }

  async command(command: CharacterCommand): Promise<void> {
    const entry = this.#characters.get(command.character);
    if (!entry) {
      throw new Error(`Unknown character: ${command.character}`);
    }

    const instance = entry.instance;

    if (command.position !== undefined) {
      await instance.setPosition(command.position);
    }
    if (command.expression !== undefined) {
      await instance.setExpression(command.expression);
      entry.expression = command.expression;
    }
    if (command.show === true) {
      await instance.show();
    }
    if (command.motion !== undefined && this.#motionEnabled) {
      await instance.playMotion(command.motion);
    }
    if (command.show === false) {
      await instance.hide();
    }
  }

  setActive(characterId?: string): void {
    for (const [id, entry] of this.#characters) {
      entry.instance.setActive?.(id === characterId);
    }
  }

  destroy(): void {
    for (const entry of this.#characters.values()) {
      entry.instance.destroy();
    }
    this.#characters.clear();
  }
}
