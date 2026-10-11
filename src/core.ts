export { AdvEngine, type AdvEngineOptions } from "./engine.js";
export { CharacterStage } from "./character-stage.js";
export { createStageLayoutPreset } from "./stage-layouts.js";
export { ScenarioCatalog, type ScenarioCatalogEntry, type ScenarioCatalogMetadata, type ScenarioPlayback } from "./scenario-catalog.js";
export type {
  AdvNode,
  BackgroundDefinition,
  CharacterCommand,
  CharacterDefinition,
  CharacterRenderer,
  ChoiceNode,
  ChoiceOption,
  ChoicePresentation,
  DialoguePresentation,
  EndNode,
  EngineSnapshot,
  GameDefinition,
  JumpNode,
  LineNode,
  RenderedCharacter,
  Scalar,
  SceneNode,
  ScenarioMetadata,
  SetNode,
  StagePosition,
  StageLayoutDefinition,
  StageLayoutMember,
  StageLayoutPreset,
  UiAdapter,
} from "./types.js";

export { InputRouter, resolveKeyInput, DEFAULT_KEY_BINDINGS, type InputAction, type InputHandler, type PhysicalKeyInput, type KeyBinding } from "./input.js";
export { SaveStore, SaveError, DEFAULT_SAVE_SLOTS, validateSaveState, type StorageAdapter, type SaveState, type SaveRecord, type SaveSummary, type SaveErrorCode, type CharacterState } from "./save.js";

export { AudioController, DEFAULT_AUDIO_VOLUMES, type AudioAdapter, type AudioChannel, type AudioVolumes, type AudioPlayOptions, type AudioStopOptions, type BgmState, type LogicalAudioState } from "./audio.js";
export type { AudioNode } from "./types.js";
