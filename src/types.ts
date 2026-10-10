export type Scalar = string | number | boolean | null;

export type StagePosition =
  | "far-left"
  | "left"
  | "center"
  | "right"
  | "far-right"
  | {
      x: number;
      y?: number;
      scale?: number;
      zIndex?: number;
    };

export interface CharacterDefinition {
  id: string;
  name: string;
  renderer: string;
  defaultExpression?: string;
  assets?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CharacterCommand {
  character: string;
  show?: boolean;
  expression?: string;
  motion?: string;
  position?: StagePosition;
}

export interface LineNode {
  type: "line";
  speaker?: string;
  text: string;
  expression?: string;
  motion?: string;
  position?: StagePosition;
  commands?: CharacterCommand[];
  next?: string;
}

export interface ChoiceOption {
  text: string;
  next: string;
  set?: Record<string, Scalar>;
}

export interface ChoiceNode {
  type: "choice";
  prompt?: string;
  options: ChoiceOption[];
}

export interface JumpNode {
  type: "jump";
  next: string;
}

export interface SetNode {
  type: "set";
  values: Record<string, Scalar>;
  next?: string;
}

export interface SceneNode {
  type: "scene";
  background?: string;
  commands?: CharacterCommand[];
  next?: string;
}

export interface EndNode {
  type: "end";
}

export type AdvNode = LineNode | ChoiceNode | JumpNode | SetNode | SceneNode | EndNode;

export interface GameDefinition {
  title?: string;
  start: string;
  characters: CharacterDefinition[];
  scenes: Record<string, AdvNode[]>;
  initialState?: Record<string, Scalar>;
}

export interface DialoguePresentation {
  /** Latest requested logical expression; never a renderer asset path. */
  expression?: string;
  speakerId?: string;
  speakerName?: string;
  text: string;
}

export interface ChoicePresentation {
  prompt?: string;
  options: readonly string[];
}

export interface UiAdapter {
  presentLine(line: DialoguePresentation): Promise<void>;
  presentChoice(choice: ChoicePresentation): Promise<number>;
  /** Clear pending interaction and present scenario completion. */
  presentEnd(): void | Promise<void>;
  setBackground?(source?: string): void | Promise<void>;
  setActiveSpeaker?(characterId?: string): void;
  setTitle?(title?: string): void;
  destroy?(): void;
}

export interface RenderedCharacter {
  show(): void | Promise<void>;
  hide(): void | Promise<void>;
  setExpression(name: string): void | Promise<void>;
  playMotion(name: string): void | Promise<void>;
  setPosition(position: StagePosition): void | Promise<void>;
  setActive?(active: boolean): void;
  destroy(): void;
}

export interface CharacterRenderer {
  readonly key: string;
  create(host: HTMLElement, character: CharacterDefinition): RenderedCharacter;
}

export interface EngineSnapshot {
  sceneId: string;
  nodeIndex: number;
  state: Record<string, Scalar>;
}
