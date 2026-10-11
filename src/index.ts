export { AdvEngine, type AdvEngineOptions } from "./engine.js";
export { CharacterStage } from "./character-stage.js";
export { createStageLayoutPreset } from "./stage-layouts.js";
export { Live2DRenderer, type Live2DRendererOptions, type Live2DModelAdapter } from "./adapters/live2d-renderer.js";
export { SpriteRenderer, spriteRendererCss, type SpriteRendererOptions, type SpriteAssets, type SpriteMotion, type SpriteMotionKeyframe, type SpritePortrait, type SpriteDisplayMode, type SpriteRenderedCharacter } from "./renderers/sprite-renderer.js";
export { DomUi, domUiCss, type DomUiElements, type DomUiOptions } from "./ui/dom-ui.js";
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
export { gameViewportCss } from "./ui/game-viewport.js";
export { defaultThemeCss } from "./ui/theme.js";
export { calculateAutoDelay, defaultAutoConfig, type AutoConfig } from "./ui/auto-timing.js";
export { BackgroundPresenter, backgroundPresenterCss, type BackgroundPresenterOptions } from "./ui/background-presenter.js";
export { DecodedImageCache, type ImageCacheOptions, type ImageLease } from "./assets/decoded-image-cache.js";
export { GameSettingsStore, DEFAULT_GAME_SETTINGS, AUTO_SPEED_MULTIPLIERS, getAutoDelayMultiplier, type GameSettings, type AutoSpeed } from "./ui/settings.js";
export { ScenarioCatalog, type ScenarioCatalogEntry, type ScenarioCatalogMetadata, type ScenarioPlayback } from "./scenario-catalog.js";

export { InputRouter, resolveKeyInput, DEFAULT_KEY_BINDINGS, type InputAction, type InputHandler, type PhysicalKeyInput, type KeyBinding } from "./input.js";

export { BrowserKeyboardInput, type KeyboardInputOptions } from "./ui/keyboard-input.js";
