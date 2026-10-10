import { defaultThemeCss } from "./theme.js";
import { fitDialoguePage } from "./dialogue-paging.js";
import type {
  ChoicePresentation,
  DialoguePresentation,
  UiAdapter,
} from "../types.js";

export interface DomUiElements {
  root: HTMLElement;
  background: HTMLElement;
  title?: HTMLElement;
  speaker: HTMLElement;
  text: HTMLElement;
  choices: HTMLElement;
  advanceTarget?: HTMLElement;
  pageIndicator?: HTMLElement;
}

export class DomUi implements UiAdapter {
  readonly #elements: DomUiElements;
  #cleanup?: () => void;

  constructor(elements: DomUiElements) {
    this.#elements = elements;
  }

  setTitle(title?: string): void {
    if (this.#elements.title) this.#elements.title.textContent = title ?? "";
  }

  setBackground(source?: string): void {
    if (!source) {
      this.#elements.background.style.backgroundImage = "";
      return;
    }
    this.#elements.background.style.backgroundImage = `url(${JSON.stringify(source).slice(1, -1)})`;
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
        end = text.clientHeight > 0 && text.clientWidth > 0
          ? fitDialoguePage(line.text, start, candidate => {
              text.textContent = candidate;
              return text.scrollHeight <= text.clientHeight + 1 && text.scrollWidth <= text.clientWidth + 1;
            })
          : line.text.length;
        text.textContent = line.text.slice(start, end);
        text.scrollTop = 0;
        this.#elements.root.dataset.page = String(page);
        if (this.#elements.pageIndicator) {
          this.#elements.pageIndicator.textContent = `${page > 1 ? page + " " : ""}${end < line.text.length ? "›" : "▼"}`;
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
          const duration = Number.parseFloat(getComputedStyle(this.#elements.root).getPropertyValue("--adv-choice-duration")) || 180;
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

export const domUiCss = defaultThemeCss + `
.adv-dialogue {
  position: absolute;
  z-index: 100;
  box-sizing: border-box;
  left: 5%; right: 5%; bottom: 3.6%;
  display: flex; flex-direction: column;
  block-size: var(--adv-dialog-height);
  padding: var(--adv-dialog-padding-top) var(--adv-dialog-padding-inline) var(--adv-dialog-padding-bottom);
  border: 1px solid var(--adv-dialog-border);
  border-radius: var(--adv-dialog-radius);
  background: var(--adv-dialog-bg);
  backdrop-filter: blur(var(--adv-dialog-blur));
  color: var(--adv-text-color);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
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
  font-weight: 600;
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
  position: absolute; z-index: 110; left: 24%; right: 24%; bottom: 30%;
  display: grid; gap: .7cqw;
  grid-auto-rows: min(5cqw, calc(25cqw / var(--adv-choice-rows, 1)));
  animation: adv-dialogue-in .18s ease;
}
.adv-choices:empty { display: none; }
.adv-choices[data-columns="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.adv-choices[data-selected="true"] { pointer-events: none; }
.adv-choice {
  appearance: none; border: 1px solid var(--adv-dialog-border);
  border-radius: .4cqw; padding: .6cqw 1.4cqw;
  background: var(--adv-choice-bg); backdrop-filter: blur(var(--adv-dialog-blur)); color: inherit;
  font: inherit; font-size: 1.25cqw; line-height: 1.4;
  text-align: left; cursor: pointer;
  transition: background .18s ease, transform .18s ease;
}
.adv-choice:hover, .adv-choice:focus-visible { background: var(--adv-choice-hover-bg); transform: translateY(-1px); }
.adv-controls { position: absolute; right: 4.2cqw; bottom: .65cqw; display: flex; gap: 1.4cqw; }
.adv-control { appearance: none; padding: .3cqw 0; border: 0; background: none; color: var(--adv-muted-color); font-size: .85cqw; letter-spacing: .12em; cursor: pointer; }
.adv-control:hover, .adv-control[aria-pressed="true"] { color: var(--adv-name-color); }
.adv-panel { width: 52cqw; max-height: 38cqw; border: 1px solid var(--adv-dialog-border); border-radius: .6cqw; padding: 2cqw; color: var(--adv-text-color); background: var(--adv-panel-bg); font-size: 1.2cqw; }
.adv-panel::backdrop { background: rgb(0 0 0 / .55); }
.adv-log-content { overflow: auto; max-height: 27cqw; white-space: pre-wrap; line-height: var(--adv-text-line-height); }
.adv-panel button { color: inherit; background: transparent; border: 1px solid var(--adv-dialog-border); padding: .5em 1em; cursor: pointer; }
@keyframes adv-dialogue-in { from { opacity: 0; } to { opacity: 1; } }
`;
