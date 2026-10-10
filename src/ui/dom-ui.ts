import { BackgroundPresenter, backgroundPresenterCss, type BackgroundPresenterOptions } from "./background-presenter.js";
import { defaultThemeCss } from "./theme.js";
import { fitDialoguePage } from "./dialogue-paging.js";
import type {
  ChoicePresentation,
  DialoguePresentation,
  UiAdapter,
  ScenarioMetadata,
  BackgroundDefinition,
} from "../types.js";

export interface DomUiElements {
  root: HTMLElement;
  background: HTMLElement;
  title?: HTMLElement;
  scenarioTitle?: HTMLElement;
  speaker: HTMLElement;
  text: HTMLElement;
  choices: HTMLElement;
  advanceTarget?: HTMLElement;
  pageIndicator?: HTMLElement;
}

export interface DomUiOptions {
  background?: BackgroundPresenterOptions;
}

export class DomUi implements UiAdapter {
  readonly #elements: DomUiElements;
  #cleanup?: () => void;
  #background?: BackgroundPresenter;
  readonly #options: DomUiOptions;
  #animationsEnabled = true;

  constructor(elements: DomUiElements, options: DomUiOptions = {}) {
    this.#options = options;
    this.#elements = elements;
  }

  setAnimationsEnabled(enabled: boolean): void {
    this.#animationsEnabled = enabled;
    this.#elements.root.dataset.uiAnimation = enabled ? "on" : "off";
    this.#background?.setAnimationsEnabled(enabled);
  }

  setTitle(title?: string): void {
    if (this.#elements.title) this.#elements.title.textContent = title ?? "";
  }

  setScenarioMetadata(metadata?: ScenarioMetadata): void {
    const element = this.#elements.scenarioTitle;
    if (!element) return;
    element.textContent = [metadata?.chapter, metadata?.title].filter(Boolean).join("\n");
    element.dataset.hasChapter = String(Boolean(metadata?.chapter));
    element.dataset.hasTitle = String(Boolean(metadata?.title));
    element.hidden = !element.textContent;
  }

  setBackground(source?: string): Promise<void> {
    return this.presentBackground(source ? { src: source } : undefined);
  }

  presentBackground(background?: BackgroundDefinition): Promise<void> {
    this.#background ??= new BackgroundPresenter(this.#elements.background, this.#options.background);
    this.#background.setAnimationsEnabled(this.#animationsEnabled);
    return this.#background.set(background);
  }

  prefetchBackground(background: BackgroundDefinition): void {
    this.#background ??= new BackgroundPresenter(this.#elements.background, this.#options.background);
    void this.#background.prefetch(background);
  }

  setActiveSpeaker(characterId?: string): void {
    this.#elements.root.dataset.speaker = characterId ?? "";
  }

  presentLine(line: DialoguePresentation): Promise<void> {
    this.#cancelPending();
    this.#elements.choices.replaceChildren();
    this.#elements.speaker.textContent = line.speakerName ?? "";
    this.#elements.speaker.hidden = !line.speakerName;
    this.#elements.text.textContent = line.text;
    this.#elements.text.scrollTop = 0;
    this.#elements.root.dataset.mode = "line";

    return new Promise((resolve) => {
      let start = 0;
      let end = 0;
      let page = 1;
      let disposed = false;
      const render = () => {
        const text = this.#elements.text;
        text.setAttribute("aria-busy", "true");
        end = text.clientHeight > 0 && text.clientWidth > 0
          ? fitDialoguePage(line.text, start, candidate => {
              text.textContent = candidate;
              return text.scrollHeight <= text.clientHeight + 1 && text.scrollWidth <= text.clientWidth + 1;
            })
          : line.text.length;
        text.textContent = line.text.slice(start, end);
        text.setAttribute("aria-busy", "false");
        text.scrollTop = 0;
        this.#elements.root.dataset.page = String(page);
        if (this.#elements.pageIndicator) {
          this.#elements.pageIndicator.textContent = "▼";
        }
      };
      render();
      const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => {
        if (!disposed) render();
      });
      observer?.observe(this.#elements.text);
      globalThis.document?.fonts?.ready.then(() => { if (!disposed) render(); });
      const target = this.#elements.advanceTarget ?? this.#elements.root;
      const controller = new AbortController();
      const finish = () => {
        disposed = true;
        observer?.disconnect();
        controller.abort();
        this.#cleanup = undefined;
        resolve();
      };

      const advance = () => {
        if (end < line.text.length) {
          start = end;
          page++;
          render();
          return;
        }
        finish();
      };
      target.addEventListener("click", advance, { signal: controller.signal });
      window.addEventListener(
        "keydown",
        (event) => {
          if (event.defaultPrevented || (event.target as Element | null)?.closest?.("button, input, textarea, select, dialog[open]")) return;
          if (["Enter", " ", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
            advance();
          }
        },
        { signal: controller.signal },
      );
      window.addEventListener("resize", render, { signal: controller.signal });
      this.#cleanup = () => {
        disposed = true;
        observer?.disconnect();
        controller.abort();
      };
    });
  }

  presentChoice(choice: ChoicePresentation): Promise<number> {
    this.#cancelPending();
    this.#elements.speaker.hidden = true;
    this.#elements.text.textContent = choice.prompt ?? "";
    this.#elements.text.scrollTop = 0;
    this.#elements.choices.replaceChildren();
    this.#elements.root.dataset.mode = "choice";
    this.#elements.choices.dataset.selected = "false";
    this.#elements.choices.dataset.columns = choice.options.length > 4 ? "2" : "1";
    this.#elements.choices.style.setProperty("--adv-choice-rows", String(Math.ceil(choice.options.length / (choice.options.length > 4 ? 2 : 1))));
    if (this.#elements.pageIndicator) this.#elements.pageIndicator.textContent = "";

    return new Promise((resolve) => {
      const controller = new AbortController();
      let selected = false;
      let animation: Animation | undefined;
      this.#cleanup = () => { controller.abort(); animation?.cancel(); };
      choice.options.forEach((label, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "adv-choice";
        button.textContent = label;
        button.addEventListener("click", async (event) => {
          event.stopPropagation();
          if (selected) return;
          selected = true;
          this.#elements.choices.dataset.selected = "true";
          const configuredTime = getComputedStyle(this.#elements.root).getPropertyValue("--adv-choice-duration").trim();
          const configuredDuration = Number.parseFloat(configuredTime) * (configuredTime.endsWith("s") && !configuredTime.endsWith("ms") ? 1000 : 1);
          const duration = Number.isFinite(configuredDuration) && configuredDuration >= 0 ? configuredDuration : 180;
          animation = this.#elements.choices.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration });
          await animation?.finished.catch(() => {});
          if (controller.signal.aborted) return;
          controller.abort();
          this.#cleanup = undefined;
          this.#elements.choices.replaceChildren();
          resolve(index);
        }, { signal: controller.signal });
        this.#elements.choices.append(button);
      });
    });
  }

  destroy(): void {
    this.#background?.destroy();
    this.#cancelPending();
    this.#elements.choices.replaceChildren();
  }

  presentEnd(): void {
    this.#cancelPending();
    this.#elements.choices.replaceChildren();
    this.#elements.speaker.textContent = "";
    this.#elements.speaker.hidden = true;
    this.setActiveSpeaker(undefined);
    this.#elements.text.textContent = "The End";
    this.#elements.root.dataset.mode = "ended";
    if (this.#elements.pageIndicator) this.#elements.pageIndicator.textContent = "";
  }

  #cancelPending(): void {
    this.#cleanup?.();
    this.#cleanup = undefined;
  }
}

export const domUiCss = defaultThemeCss + backgroundPresenterCss + `
.adv-background { isolation: isolate; }
.adv-background::after { content: ""; position: absolute; inset: 0; background: #000; opacity: var(--adv-background-overlay, 0); pointer-events: none; z-index: 2; }
.adv-scenario-title { position: absolute; z-index: 80; top: 3.5%; left: 4%; margin: 0; white-space: pre-line; font: 500 1cqw/1.6 var(--adv-ui-font); color: var(--adv-muted-color); text-shadow: 0 1px 5px #000; opacity: .85; pointer-events: none; }
.adv-dialogue {
  position: absolute;
  z-index: 100;
  box-sizing: border-box;
  left: 50%; width: var(--adv-dialog-width); bottom: 3.6%; transform: translateX(-50%);
  display: flex; flex-direction: column;
  block-size: var(--adv-dialog-height);
  padding: var(--adv-dialog-padding-top) var(--adv-dialog-padding-inline) var(--adv-dialog-padding-bottom);
  border: 1px solid var(--adv-dialog-border);
  border-radius: var(--adv-dialog-radius);
  background: var(--adv-dialog-bg);
  backdrop-filter: blur(var(--adv-dialog-blur));
  color: var(--adv-text-color);
  font-family: var(--adv-text-font);
  font-weight: var(--adv-text-weight);
  animation: adv-dialogue-in var(--adv-transition-duration) ease;
}
.adv-speaker {
  position: absolute;
  top: .8cqw; left: var(--adv-dialog-padding-inline);
  min-inline-size: 8cqw;
  padding-block-end: .3cqw;
  border-block-end: 1px solid var(--adv-accent);
  color: var(--adv-name-color);
  font-size: 1.2cqw;
  font-family: var(--adv-ui-font);
  font-weight: var(--adv-name-weight);
  letter-spacing: .12em;
}
.adv-text {
  flex: 1 1 auto; min-block-size: 0;
  overflow: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: var(--adv-text-size);
  line-height: var(--adv-text-line-height);
}
.adv-page-indicator { position: absolute; right: 2.2cqw; bottom: .8cqw; font-size: 1cqw; opacity: .65; }
.adv-choices {
  position: absolute; z-index: 110; left: calc((100% - var(--adv-choice-width)) / 2); width: var(--adv-choice-width); bottom: 30%;
  display: grid; gap: var(--adv-choice-gap);
  grid-auto-rows: min(var(--adv-choice-row-size), calc(25cqw / var(--adv-choice-rows, 1)));
  animation: adv-dialogue-in .18s ease;
}
.adv-choices:empty { display: none; }
.adv-choices[data-columns="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.adv-choices[data-selected="true"] { pointer-events: none; }
.adv-choice {
  appearance: none; border: 1px solid var(--adv-choice-border);
  border-radius: .4cqw; padding: .6cqw 1.4cqw;
  background: var(--adv-choice-bg); backdrop-filter: blur(var(--adv-dialog-blur)); color: inherit;
  font: inherit; color: var(--adv-text-color); font-size: 1.25cqw; line-height: 1.4;
  text-align: left; cursor: pointer;
  transition: background .18s ease, transform .18s ease;
}
.adv-choice:hover, .adv-choice:focus-visible { background: var(--adv-choice-hover-bg); transform: translateY(-1px); }
.adv-controls { position: absolute; right: 6cqw; bottom: .65cqw; display: flex; gap: 1.4cqw; }
.adv-control { appearance: none; padding: .3cqw 0; border: 0; background: none; color: var(--adv-muted-color); font-family: var(--adv-ui-font); font-size: .85cqw; letter-spacing: .12em; cursor: pointer; }
.adv-control:hover, .adv-control[aria-pressed="true"] { color: var(--adv-name-color); }
.adv-panel { width: 52cqw; max-height: 38cqw; border: 1px solid var(--adv-dialog-border); border-radius: .6cqw; padding: 2cqw; color: var(--adv-text-color); background: var(--adv-panel-bg); font-family: var(--adv-text-font); font-size: 1.2cqw; }
.adv-panel::backdrop { background: rgb(0 0 0 / .55); }
 .adv-log-panel { box-sizing: border-box; width: 90cqw; height: 48cqw; max-height: 90vh; padding: 0; background: var(--adv-panel-bg); backdrop-filter: blur(8px); }
.adv-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 1cqw 2cqw; border-bottom: 1px solid var(--adv-log-separator); }
.adv-panel-header h2 { margin: 0; font-size: 1.1cqw; }
.adv-log-content { box-sizing: border-box; height: calc(100% - 4.5cqw); overflow-y: auto; padding: 0 3cqw; line-height: var(--adv-text-line-height); }
.adv-log-entry { position: relative; padding: 1.6cqw 0 1.6cqw calc(var(--adv-log-icon-size) + var(--adv-log-entry-gap)); border-bottom: 1px solid var(--adv-log-separator); }
.adv-log-header { min-height: 1.8cqw; }
.adv-log-name { color: var(--adv-name-color); font-family: var(--adv-ui-font); font-weight: var(--adv-name-weight); }
.adv-log-text { white-space: pre-wrap; margin: .3cqw 0 0; font-size: 1.25cqw; }
.adv-log-avatar { position: absolute; left: 0; top: 1.6cqw; width: var(--adv-log-icon-size); height: var(--adv-log-icon-size); border-radius: 50%; overflow: hidden; background: rgb(255 255 255 / .05); border: 1px solid var(--adv-log-separator); }
.adv-log-avatar img { position: absolute; width: calc(100% * var(--adv-log-portrait-scale)); height: auto; max-width: none; left: calc(100% * var(--adv-log-portrait-anchor-x)); top: calc(100% * var(--adv-log-portrait-anchor-y)); transform: translate(calc(-100% * var(--adv-log-portrait-anchor-x)), calc(-100% * var(--adv-log-portrait-anchor-y))); }
.adv-log-entry--narration { padding-left: 2cqw; color: var(--adv-muted-color); }
.adv-log-entry--narration .adv-log-header { display: none; }
.adv-log-entry--without-icon { padding-left: 2cqw; }
.adv-log-entry--latest { background: rgb(255 255 255 / .025); }
.adv-log-panel .adv-panel-header button { border: 0; font-family: var(--adv-ui-font); font-size: 1cqw; }
.adv-log-panel .adv-panel-header button:hover, .adv-log-panel .adv-panel-header button:focus-visible { color: var(--adv-accent); }
.adv-panel button { color: inherit; background: transparent; border: 1px solid var(--adv-dialog-border); padding: .5em 1em; cursor: pointer; }
.adv-viewport[data-speaker=""] .adv-sprite-character[data-visible="true"] {
  filter: brightness(var(--adv-narration-brightness));
  opacity: var(--adv-narration-opacity);
}
.adv-viewport[data-ui-animation="off"] { --adv-transition-duration: 0ms; --adv-choice-duration: 0ms; --adv-focus-duration: 0ms; }
.adv-viewport[data-ui-animation="off"] :is(.adv-dialogue, .adv-choices, .adv-choice, .adv-panel, .adv-panel button),
.adv-viewport[data-ui-animation="off"]::after { animation: none !important; transition: none !important; }
@media (prefers-reduced-motion: reduce) {
  .adv-viewport { --adv-transition-duration: 0ms; --adv-choice-duration: 0ms; --adv-focus-duration: 0ms; }
  .adv-dialogue, .adv-choices, .adv-choice { animation: none; transition: none; }
}
@keyframes adv-dialogue-in { from { opacity: 0; } to { opacity: 1; } }
`;
