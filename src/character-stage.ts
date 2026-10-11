import type { CharacterState } from "./save.js";
import type {
  CharacterCommand,
  CharacterDefinition,
  CharacterRenderer,
  RenderedCharacter,
  StageLayoutDefinition,
  StagePosition,
} from "./types.js";

interface CharacterEntry {
  definition: CharacterDefinition;
  instance: RenderedCharacter;
  expression?: string;
  visible: boolean;
  position: StagePosition;
}

export class CharacterStage<Host = unknown> {
  #motionEnabled = true;
  readonly #characters = new Map<string, CharacterEntry>();

  constructor(
    host: Host,
    characters: readonly CharacterDefinition[],
    renderers: readonly CharacterRenderer<Host>[],
  ) {
    if (new Set(characters.map(c => c.id)).size !== characters.length) throw new Error("Duplicate character id in stage.");
    if (new Set(renderers.map(r => r.key)).size !== renderers.length) throw new Error("Duplicate renderer key in stage.");
    const rendererMap = new Map(renderers.map((renderer) => [renderer.key, renderer]));

    for (const character of characters) {
      if (!rendererMap.has(character.renderer)) throw new Error(`Renderer "${character.renderer}" for character "${character.id}" is not registered.`);
    }
    try { for (const character of characters) {
      const renderer = rendererMap.get(character.renderer);
      if (!renderer) {
        throw new Error(
          `Renderer \"${character.renderer}\" for character \"${character.id}\" is not registered.`,
        );
      }

      const instance = renderer.create(host, character);
      this.#characters.set(character.id, { definition: character, instance, expression: character.defaultExpression ?? instance.initialExpression, visible: false, position: "center" });
    } } catch (error) {
      this.destroy();
      throw error;
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

  async applyLayout(layout: StageLayoutDefinition): Promise<void> {
    const members = new Map(layout.members.map((member) => [member.character, member]));
    for (const characterId of members.keys()) {
      if (!this.#characters.has(characterId)) throw new Error(`Unknown character: ${characterId}`);
    }

    for (const [characterId, member] of members) {
      if (member.position !== undefined) await this.command({ character: characterId, position: member.position });
    }
    if (layout.hideOthers !== false) {
      for (const characterId of this.#characters.keys()) {
        if (!members.has(characterId)) await this.command({ character: characterId, show: false });
      }
    }
    for (const [characterId, member] of members) {
      await this.command({ character: characterId, show: member.show !== false });
    }
  }

  async command(command: CharacterCommand): Promise<void> {
    const entry = this.#characters.get(command.character);
    if (!entry) {
      throw new Error(`Unknown character: ${command.character}`);
    }

    const instance = entry.instance;

    if (command.position !== undefined) {
      await instance.setPosition(command.position);
      entry.position = structuredClone(command.position);
    }
    if (command.expression !== undefined) {
      await instance.setExpression(command.expression);
      entry.expression = command.expression;
    }
    if (command.show === true) {
      await instance.show();
      entry.visible = true;
    }
    if (command.motion !== undefined && this.#motionEnabled) {
      await instance.playMotion(command.motion);
    }
    if (command.show === false) {
      await instance.hide();
      entry.visible = false;
    }
  }

  snapshot(): CharacterState[] {
    return [...this.#characters].map(([character, entry]) => ({ character, visible: entry.visible,
      expression: entry.expression, position: structuredClone(entry.position) }));
  }

  async restore(states: readonly CharacterState[]): Promise<void> {
    const byId = new Map(states.map(state => [state.character, state]));
    if (byId.size !== this.#characters.size || [...byId.keys()].some(id => !this.#characters.has(id))) {
      throw new Error("Saved character registry does not match the stage.");
    }
    for (const [character, entry] of this.#characters) {
      if (byId.get(character)!.expression === undefined && entry.expression !== undefined && entry.definition.defaultExpression === undefined && entry.instance.initialExpression === undefined) {
        throw new Error("Restoring an unspecified expression requires defaultExpression or renderer.initialExpression.");
      }
    }
    for (const [character, entry] of this.#characters) {
      const state = byId.get(character)!;
      entry.instance.stopMotion?.();
      await this.command({ character, position: state.position, expression: state.expression ?? entry.definition.defaultExpression ?? entry.instance.initialExpression, show: state.visible });
      entry.expression = state.expression ?? entry.definition.defaultExpression ?? entry.instance.initialExpression;
    }
    this.setActive(undefined);
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
