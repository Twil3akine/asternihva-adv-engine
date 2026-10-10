import {
  ScenarioCatalog,
  CharacterStage,
  SpriteRenderer,
  GameSettingsStore,
  DecodedImageCache,
  domUiCss,
  gameViewportCss,
  spriteRendererCss,
} from "../../dist/index.js";

import { backgroundManifest, initialBackground } from "./background-manifest.mjs";
import { stageLayoutManifest } from "./stage-layout-manifest.mjs";
import { assetManifest } from "./asset-manifest.mjs";
import { resolveLogPortrait } from "./demo-log.mjs";
import { attachSettings } from "./demo-settings.mjs";
import { demoUiConfig } from "./ui-config.mjs";
import { DemoUi, attachControls, presentEpisodeTitle } from "./demo-controls.mjs";
import { attachGameShell } from './game-shell.mjs';
import { motions } from "./motions.mjs";
import { loadLocalScenarios } from "./local-scenarios.mjs";
import { loadDemoAssets } from "./demo-assets.mjs";


const style = document.createElement("style");
style.textContent = gameViewportCss + spriteRendererCss + domUiCss;
document.head.append(style);

await Promise.all([
  document.fonts.load('400 16px "Zen Kaku Gothic New"', "日本語の表示を確認します"),
  document.fonts.load('500 16px "Zen Kaku Gothic New"', "Noah セレナ"),
  document.fonts.load('400 16px Ubuntu', "EP.00 AUTO MENU"),
].map(promise => promise.catch(() => [])));


const debug = new URLSearchParams(location.search).get("debug") === "1";
const [loaded, firstBackground] = await Promise.all([loadDemoAssets(), initialBackground()]);
const status = document.querySelector("#asset-status");
const gameRoot = document.querySelector("#game");
gameRoot.dataset.debug = String(debug);
document.querySelector("[data-debug-panel]").hidden = !debug;
status.hidden = !debug && !loaded.missing.length;
status.textContent = loaded.missing.length
  ? debug
    ? "ローカル画像が不足しています。node scripts/import-asternihva-assets.mjsで導入できます。"
    : "立ち絵が未導入のため、仮画像で表示しています。"
  : "Local PNG / expression crossfade / motion";
gameRoot.dataset.assets = loaded.missing.length ? "fallback" : "local";

const sharedGame = {
  title: "Asternihva Project",
  backgrounds: backgroundManifest,
  stageLayouts: stageLayoutManifest,
  characters: loaded.characters.map(({ local, ...character }) => ({
    ...character, assets: { ...character.assets, motions },
  })),
};
let localScenarios;
try {
  localScenarios = await loadLocalScenarios();
} catch (error) {
  status.hidden = false;
  status.textContent = `ローカルScenarioを読み込めませんでした: ${error.message}`;
  localScenarios = [];
}

const root = document.querySelector("#game");
const stageHost = document.querySelector("#stage");
const logIcons = Object.fromEntries(loaded.characters.map(character => [character.id, {
  expressions: character.assets.expressions,
  portrait: assetManifest.find(entry => entry.id === character.id).logPortrait,
}]));
const imageCache = new DecodedImageCache({ maxDecodedImages: 8 });
let currentUi, currentStage, currentEngine;
let shell, controls;
let settingsStorage;
try { settingsStorage = localStorage; } catch { /* Settings still work without persistence. */ }
const settings = new GameSettingsStore(settingsStorage);
const scenarioEntries = localScenarios.map(definition => ({
  ...definition.scenario, entry: { ...sharedGame, ...definition },
}));
const catalog = new ScenarioCatalog(scenarioEntries);
const uiElements = {
  root, background: document.querySelector("#background"), title: document.querySelector("#title"),
  scenarioTitle: document.querySelector("#scenario-title"), speaker: document.querySelector("#speaker"),
  text: document.querySelector("#text"), pageIndicator: document.querySelector("#page-indicator"),
  choices: document.querySelector("#choices"), advanceTarget: root,
};
const disposePlayback = () => {
  controls?.stop();
  root.querySelectorAll('dialog[open]').forEach(panel => panel.close());
  currentEngine?.destroy();
  currentUi = currentStage = currentEngine = undefined;
  document.querySelector('#end-card').hidden = true;
  document.querySelector('#episode-title').hidden = true;
  document.querySelector('#choices').replaceChildren();
};
controls = attachControls(root, { renderLog: container => currentUi?.renderLog(container) }, demoUiConfig, settings, {
  onRestart: () => shell.replay(),
});
attachSettings(root, settings, {
  ui: { setAnimationsEnabled: enabled => { root.dataset.uiAnimation = enabled ? 'on' : 'off'; currentUi?.setAnimationsEnabled(enabled); } },
  stage: { setMotionEnabled: enabled => currentStage?.setMotionEnabled(enabled) },
  onBack: () => {
    if (root.dataset.screen === 'game') {
      document.querySelector('#menu-panel').showModal();
      document.querySelector('[data-menu-action="settings"]').focus();
    } else document.querySelector('[data-shell-action="settings"]').focus();
  },
});
shell = attachGameShell(root, catalog, {
  onLeave: disposePlayback,
  onSettings: () => document.querySelector('#settings-panel').showModal(),
  onStart: async id => {
    disposePlayback();
    const definition = scenarioEntries.find(entry => entry.id === id).entry;
    currentUi = new DemoUi(uiElements, {
      resolveIcon: entry => resolveLogPortrait(entry, logIcons),
      endCard: document.querySelector('#end-card'), scenario: catalog.getScenarioMetadata(id),
      onReplay: () => shell.replay(), background: { imageCache, transitionDuration: 320 },
    });
    currentStage = new CharacterStage(stageHost, definition.characters, [new SpriteRenderer({ imageCache })]);
    currentUi.setAnimationsEnabled(settings.value.uiAnimation);
    currentStage.setMotionEnabled(settings.value.characterMotion);
    await currentUi.presentBackground(firstBackground ? definition.backgrounds?.[firstBackground] : undefined);
    await presentEpisodeTitle(root, document.querySelector('#episode-title'), catalog.getScenarioMetadata(id));
    const playback = catalog.startScenario(id, { stage: currentStage, ui: currentUi });
    currentEngine = playback.engine;
    return playback;
  },
});
