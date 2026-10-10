import {
  AdvEngine,
  CharacterStage,
  DomUi,
  SpriteRenderer,
  domUiCss,
  gameViewportCss,
  spriteRendererCss,
} from "../../dist/index.js";

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

const loaded = await loadDemoAssets();
const status = document.querySelector("#asset-status");
status.textContent = loaded.missing.length
  ? "ローカル画像が未導入または不足しています。該当キャラクターは仮画像で表示します。node scripts/import-asternihva-assets.mjsで導入できます。"
  : "ローカルPNGを表示しています。狭い画面では立ち絵の欄を横にスクロールできます。";
document.querySelector("#game").dataset.assets = loaded.missing.length ? "fallback" : "local";

const game = {
  title: "Asternihva Project — engine demo",
  start: "intro",
  characters: loaded.characters.map(({ local, ...character }) => ({
    ...character,
    assets: { ...character.assets, motions },
  })),
  scenes: { intro: [{ type: "end" }] },
};

const root = document.querySelector("#game");
const stageHost = document.querySelector("#stage");
const ui = new DomUi({
  root,
  background: document.querySelector("#background"),
  title: document.querySelector("#title"),
  speaker: document.querySelector("#speaker"),
  text: document.querySelector("#text"),
  pageIndicator: document.querySelector("#page-indicator"),
  choices: document.querySelector("#choices"),
  advanceTarget: document.querySelector("#dialogue"),
});
const stage = new CharacterStage(stageHost, game.characters, [new SpriteRenderer()]);
const engine = new AdvEngine({ game, stage, ui });
engine.run();
