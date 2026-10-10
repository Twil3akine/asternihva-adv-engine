import {
  AdvEngine,
  CharacterStage,
  SpriteRenderer,
  GameSettingsStore,
  domUiCss,
  gameViewportCss,
  spriteRendererCss,
} from "../../dist/index.js";

import { assetManifest } from "./asset-manifest.mjs";
import { resolveLogPortrait } from "./demo-log.mjs";
import { attachSettings } from "./demo-settings.mjs";
import { demoUiConfig } from "./ui-config.mjs";
import { DemoUi, attachControls } from "./demo-controls.mjs";
import { loadDemoAssets } from "./demo-assets.mjs";

const base = new URL("./", import.meta.url);
const asset = (name) => new URL(`assets/${name}`, base).href;

const style = document.createElement("style");
style.textContent = gameViewportCss + spriteRendererCss + domUiCss;
document.head.append(style);

const motions = {
  bounce: { keyframes: [{ translate: "0 0" }, { translate: "0 -8px" }, { translate: "0 0" }], duration: 620 },
  nod: { keyframes: [{ rotate: "0deg" }, { rotate: "1deg" }, { rotate: "0deg" }], duration: 580 },
  pulse: { keyframes: [{ scale: 1, opacity: 1 }, { scale: 1.02, opacity: 1 }, { scale: 1, opacity: 1 }], duration: 620 },
};

const debug = new URLSearchParams(location.search).get("debug") === "1";
const loaded = await loadDemoAssets();
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
const ui = new DemoUi({
  root,
  background: document.querySelector("#background"),
  title: document.querySelector("#title"),
  speaker: document.querySelector("#speaker"),
  text: document.querySelector("#text"),
  pageIndicator: document.querySelector("#page-indicator"),
  choices: document.querySelector("#choices"),
  advanceTarget: document.querySelector("#dialogue"),
}, { resolveIcon: entry => resolveLogPortrait(entry, logIcons) });
const stage = new CharacterStage(stageHost, game.characters, [new SpriteRenderer()]);
const engine = new AdvEngine({ game, stage, ui });
let settingsStorage;
try { settingsStorage = localStorage; } catch { /* Settings still work without persistence. */ }
const settings = new GameSettingsStore(settingsStorage);
attachControls(root, ui, demoUiConfig, settings);
attachSettings(root, settings, { ui, stage });
engine.run();
