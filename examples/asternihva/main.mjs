import {
  ScenarioCatalog,
  CharacterStage,
  SpriteRenderer,
  GameSettingsStore,
  DecodedImageCache,
  domUiCss,
  gameViewportCss,
  spriteRendererCss,
  AudioController, InputRouter, SaveStore, SaveError,
} from "../../dist/index.js";

import { ChapterProgressStore, LocalStorageAdapter, SaveLoadPanel, saveLoadPanelCss, BrowserAudioAdapter, BrowserKeyboardInput } from "../../dist/web.js";

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
style.textContent = gameViewportCss + spriteRendererCss + domUiCss + saveLoadPanelCss;
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
let currentUi, currentStage, currentEngine, currentAudio, releasePlayback;
let shell, controls;
let settingsStorage;
try { settingsStorage = localStorage; } catch { /* Settings still work without persistence. */ }
const settings = new GameSettingsStore(settingsStorage);
const input = new InputRouter();
// When persistence is denied, keep this session usable without claiming durable saves.
const sessionSaves = new Map();
const saves = new SaveStore(settingsStorage ? new LocalStorageAdapter(settingsStorage) : {
  getItem: key => sessionSaves.get(key) ?? null,
  setItem: (key, value) => { sessionSaves.set(key, value); },
  removeItem: key => { sessionSaves.delete(key); },
}, 'asternihva.saves');
const reportError = error => { status.hidden = false; status.textContent = `操作できませんでした: ${error.message}`; };
if (!settingsStorage) { status.hidden = false; status.textContent = '保存領域を利用できないため、セーブはこの画面を閉じるまで有効です。'; }
const progress = new ChapterProgressStore(settingsStorage, "asternihva.chapter-progress");
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
  releasePlayback?.(); releasePlayback = undefined;
  currentAudio = undefined;
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
  progress, input,
  onLeave: disposePlayback,
  onSettings: () => document.querySelector('#settings-panel').showModal(),
  onStart: async (id, { saveState, signal }) => {
    const definition = scenarioEntries.find(entry => entry.id === id).entry;
    const ui = currentUi = new DemoUi(uiElements, {
      input, keyboard: false,
      resolveIcon: entry => resolveLogPortrait(entry, logIcons),
      endCard: document.querySelector('#end-card'), scenario: catalog.getScenarioMetadata(id),
      onReplay: () => shell.replay(), background: { imageCache, transitionDuration: 320 },
    });
    const stage = currentStage = new CharacterStage(stageHost, definition.characters, [new SpriteRenderer({ imageCache })]);
    const adapter = new BrowserAudioAdapter({ assets: definition.audioAssets ?? {} });
    const audio = new AudioController(adapter);
    currentAudio = Object.keys(definition.audioAssets ?? {}).length ? adapter : undefined;
    const unbindAudio = settings.bindAudio(audio);
    let engine, disposed = false;
    const release = () => {
      if (disposed) return;
      disposed = true; signal.removeEventListener('abort', release); unbindAudio();
      if (engine) engine.destroy(); else { stage.destroy(); ui.destroy(); audio.destroy(); }
    };
    signal.addEventListener('abort', release, { once: true });
    releasePlayback = release;
    ui.setAnimationsEnabled(settings.value.uiAnimation);
    stage.setMotionEnabled(settings.value.characterMotion);
    try {
      signal.throwIfAborted();
      if (currentAudio) void adapter.unlock().catch(error => { if (!signal.aborted) reportError(error); });
      if (!saveState) {
        await ui.presentBackground(firstBackground ? definition.backgrounds?.[firstBackground] : undefined);
        signal.throwIfAborted();
        await presentEpisodeTitle(root, document.querySelector('#episode-title'), catalog.getScenarioMetadata(id), { signal });
      }
      signal.throwIfAborted();
      // Construct the matching stage before restoring a catalog save; never run intro nodes first.
      if (saveState) {
        engine = currentEngine = catalog.createScenario(id, { stage, ui, audio, saves, progress, autosave: true, onAutosaveError: reportError });
        await engine.restoreSaveState(saveState);
        signal.throwIfAborted();
        return { engine, finished: engine.run() };
      }
      const playback = catalog.startScenario(id, { stage, ui, audio, saves, progress, autosave: true, onAutosaveError: reportError });
      engine = currentEngine = playback.engine;
      return playback;
    } catch (error) { release(); throw error; }
  },
});

const panel = new SaveLoadPanel(root, {
  saves,
  onSave: async slot => {
    controls.stop();
    if (!currentEngine || root.dataset.screen !== 'game') throw new SaveError('busy', '再生中の章がありません。');
    return currentEngine.save(slot);
  },
  onLoad: async slot => {
    controls.stop();
    const { state } = await saves.load(slot);
    if (!catalog.getScenarioMetadata(state.scenarioId)) throw new SaveError('scenario-missing', '保存した章を読み込めません。');
    if (!await shell.restore(state)) throw new SaveError('busy', '章の切替が完了していません。');
  },
  onError: reportError,
  labels: { save: 'セーブ', load: 'ロード', delete: '削除', close: '閉じる', empty: '空き', unreadable: '読み込めないセーブ', loading: '読込中…', saved: '保存しました', deleted: '削除しました',
    slots: { autosave: 'オートセーブ', quicksave: 'クイックセーブ', ...Object.fromEntries([1,2,3,4,5].map(i => [`manual-${i}`, `セーブ ${i}`])) } },
});
root.tabIndex = -1;
const focusPlayback = () => {
  if (root.dataset.screen !== 'game' || root.querySelector('dialog[open]')) return;
  if (root.dataset.mode === 'choice') root.querySelector('#choices button')?.focus();
  else root.focus({ preventScroll: true });
};
for (const dialog of root.querySelectorAll('dialog')) dialog.addEventListener('close', focusPlayback);
for (const button of root.querySelectorAll('[data-save-action]')) button.addEventListener('click', () => {
  controls.stop(); root.querySelector('#menu-panel').close();
  void panel.open(button.dataset.saveAction).catch(reportError);
});
input.subscribe(action => {
  const modal = root.querySelector('dialog[open]');
  if (modal && modal !== panel.element) {
    if (action === 'cancel') {
      if (modal.id === 'settings-panel') modal.querySelector('[data-settings-back]').click();
      else modal.close();
    }
    return true;
  }
  if (panel.element.open || ['quickSave', 'quickLoad'].includes(action)) return panel.handleAction(action);
  return controls.handleAction(action);
}, 100);
const keyboard = new BrowserKeyboardInput(input, {
  context: () => root.querySelector('dialog[open]') ? 'overlay' : root.dataset.mode,
  shouldHandle: event => {
    const target = event.target;
    if (target?.closest?.('input, textarea, select, [contenteditable]')) return event.key === 'Escape';
    if (['Escape', 'F5', 'F9'].includes(event.key)) return true;
    if (root.querySelector('dialog[open]')) return false;
    return !target?.closest?.('button, a, .adv-controls') || Boolean(root.querySelector('#choices').contains(target));
  },
});
const unlockAudio = () => { if (currentAudio) void currentAudio.unlock().catch(reportError); };
root.addEventListener('pointerdown', unlockAudio);
root.addEventListener('keydown', unlockAudio);
window.addEventListener('pagehide', () => { panel.destroy(); keyboard.destroy(); root.removeEventListener('pointerdown', unlockAudio); root.removeEventListener('keydown', unlockAudio); }, { once: true });
