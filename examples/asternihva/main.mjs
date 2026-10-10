import {
  AdvEngine,
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
import { loadDemoAssets } from "./demo-assets.mjs";


const style = document.createElement("style");
style.textContent = gameViewportCss + spriteRendererCss + domUiCss;
document.head.append(style);

await Promise.all([
  document.fonts.load('400 16px "Zen Kaku Gothic New"', "日本語の表示を確認します"),
  document.fonts.load('500 16px "Zen Kaku Gothic New"', "Noah セレナ"),
  document.fonts.load('400 16px Ubuntu', "EP.00 AUTO MENU"),
].map(promise => promise.catch(() => [])));

const motions = {
  bounce: { keyframes: [{ translate: "0 0" }, { translate: "0 -8px" }, { translate: "0 0" }], duration: 620 },
  nod: { keyframes: [{ rotate: "0deg" }, { rotate: "1deg" }, { rotate: "0deg" }], duration: 580 },
  pulse: { keyframes: [{ scale: 1, opacity: 1 }, { scale: 1.02, opacity: 1 }, { scale: 1, opacity: 1 }], duration: 620 },
};

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

const game = {
  title: "Asternihva Project",
  scenario: { id: "ep00", chapter: "EP.00", title: "小さな光" },
  backgrounds: backgroundManifest,
  stageLayouts: stageLayoutManifest,
  start: "intro",
  characters: loaded.characters.map(({ local, ...character }) => ({
    ...character,
    assets: { ...character.assets, motions },
  })),
  scenes: { intro: [{ type: "end" }] },
};

const root = document.querySelector("#game");
const stageHost = document.querySelector("#stage");
const logIcons = Object.fromEntries(loaded.characters.map(character => [character.id, {
  expressions: character.assets.expressions,
  portrait: assetManifest.find(entry => entry.id === character.id).logPortrait,
}]));
const imageCache = new DecodedImageCache({ maxDecodedImages: 8 });
const ui = new DemoUi({
  root,
  background: document.querySelector("#background"),
  title: document.querySelector("#title"),
  scenarioTitle: document.querySelector("#scenario-title"),
  speaker: document.querySelector("#speaker"),
  text: document.querySelector("#text"),
  pageIndicator: document.querySelector("#page-indicator"),
  choices: document.querySelector("#choices"),
  advanceTarget: document.querySelector("#dialogue"),
}, { resolveIcon: entry => resolveLogPortrait(entry, logIcons), background: { imageCache, transitionDuration: 320 } });
const stage = new CharacterStage(stageHost, game.characters, [new SpriteRenderer({ imageCache })]);
const engine = new AdvEngine({ game, stage, ui });
let settingsStorage;
try { settingsStorage = localStorage; } catch { /* Settings still work without persistence. */ }
const settings = new GameSettingsStore(settingsStorage);
attachControls(root, ui, demoUiConfig, settings);
attachSettings(root, settings, { ui, stage });
await ui.presentBackground(firstBackground ? game.backgrounds[firstBackground] : undefined);
await presentEpisodeTitle(root, document.querySelector('#episode-title'), game.scenario);
engine.run();
