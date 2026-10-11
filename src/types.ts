import type { AudioChannel, AudioPlayOptions, AudioStopOptions } from "./audio.js";
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

export interface AudioNode extends AudioPlayOptions, AudioStopOptions {
  type: "audio";
  channel: AudioChannel;
  /** Omit ID to stop the channel. */
  id?: string;
  next?: string;
}

export interface LineNode {
  type: "line";
  voice?: string;
  speaker?: string;
  text: string;
  layout?: string;
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
  layout?: string;
  commands?: CharacterCommand[];
  next?: string;
}

export interface EndNode {
  type: "end";
}

export type AdvNode = AudioNode | LineNode | ChoiceNode | JumpNode | SetNode | SceneNode | EndNode;

export interface ScenarioMetadata {
  description?: string;
  order?: number;
  id?: string;
  title?: string;
  chapter?: string;
}

export interface BackgroundDefinition {
  src: string;
  anchorX?: number;
  anchorY?: number;
  /** Dark overlay opacity from 0 to 1. */
  overlay?: number;
}

export interface StageLayoutMember {
  character: string;
  position?: StagePosition;
  show?: boolean;
}

export interface StageLayoutDefinition {
  /** Characters omitted from this layout are hidden by default. */
  members: readonly StageLayoutMember[];
  hideOthers?: boolean;
}

export type StageLayoutPreset = "trio" | "duo-left" | "duo-right" | "solo-center" | "solo-close" | "narration";

export interface GameDefinition {
  audioAssets?: Record<string, string>;
  backgrounds?: Record<string, BackgroundDefinition>;
  stageLayouts?: Record<string, StageLayoutDefinition>;
  scenario?: ScenarioMetadata;
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
  presentBackground?(background?: BackgroundDefinition): void | Promise<void>;
  prefetchBackground?(background: BackgroundDefinition): void | Promise<void>;
  setActiveSpeaker?(characterId?: string): void;
  setTitle?(title?: string): void;
  setScenarioMetadata?(metadata?: ScenarioMetadata): void;
  /** Discard pending interaction when playback is stopped or replaced. */
  cancelPending?(): void;
  destroy?(): void;
}

export interface RenderedCharacter {
  /** Logical initial expression, when the renderer selects a default itself. */
  readonly initialExpression?: string;
  show(): void | Promise<void>;
  hide(): void | Promise<void>;
  setExpression(name: string): void | Promise<void>;
  playMotion(name: string): void | Promise<void>;
  stopMotion?(): void;
  setPosition(position: StagePosition): void | Promise<void>;
  setActive?(active: boolean): void;
  destroy(): void;
}

export interface CharacterRenderer<Host = unknown> {
  readonly key: string;
  create(host: Host, character: CharacterDefinition): RenderedCharacter;
}

export interface EngineSnapshot {
  sceneId: string;
  nodeIndex: number;
  state: Record<string, Scalar>;
}
