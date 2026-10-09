import {
  AdvEngine,
  CharacterStage,
  DomUi,
  SpriteRenderer,
  domUiCss,
  spriteRendererCss,
} from "../../dist/index.js";

const base = new URL("./", import.meta.url);
const asset = (name) => new URL(`assets/${name}`, base).href;

const style = document.createElement("style");
style.textContent = spriteRendererCss + domUiCss;
document.head.append(style);

const motions = {
  bounce: { keyframes: [{ translate: "0 0" }, { translate: "0 -24px" }, { translate: "0 0" }], duration: 620 },
  nod: { keyframes: [{ rotate: "0deg" }, { rotate: "2deg" }, { rotate: "0deg" }], duration: 580 },
  pulse: { keyframes: [{ scale: 1, opacity: 1 }, { scale: 1.06, opacity: 0.75 }, { scale: 1, opacity: 1 }], duration: 620 },
};

const game = {
  title: "Asternihva Project — engine demo",
  start: "intro",
  characters: [
    {
      id: "noah",
      name: "Noah",
      renderer: "sprite",
      defaultExpression: "normal",
      assets: {
        motions,
        expressions: {
          normal: asset("noah-normal.svg"),
          smile: asset("noah-smile.svg"),
          surprised: asset("noah-surprised.svg"),
        },
      },
    },
    {
      id: "seren",
      name: "Seren",
      renderer: "sprite",
      defaultExpression: "normal",
      assets: {
        motions,
        expressions: {
          normal: asset("seren-normal.svg"),
          smile: asset("seren-smile.svg"),
        },
      },
    },
    {
      id: "luminal",
      name: "Luminal",
      renderer: "sprite",
      defaultExpression: "normal",
      assets: {
        motions,
        expressions: {
          normal: asset("luminal-normal.svg"),
          smile: asset("luminal-smile.svg"),
        },
      },
    },
  ],
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
  choices: document.querySelector("#choices"),
  advanceTarget: document.querySelector("#dialogue"),
});
const stage = new CharacterStage(stageHost, game.characters, [new SpriteRenderer()]);
const engine = new AdvEngine({ game, stage, ui });
engine.run();
