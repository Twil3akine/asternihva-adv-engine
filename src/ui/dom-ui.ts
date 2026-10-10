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
    if (this.#elements.pageIndicator) this.#elements.pageIndicator.textContent = "";

    return new Promise((resolve) => {
      choice.options.forEach((label, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "adv-choice";
        button.textContent = label;
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          this.#elements.choices.replaceChildren();
          resolve(index);
        }, { once: true });
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

export const domUiCss = `
.adv-dialogue {
  position: absolute;
  z-index: 100;
  box-sizing: border-box;
  left: 5%; right: 5%; bottom: 3.6%;
  display: flex; flex-direction: column;
  block-size: 24%;
  padding: 3.2cqw 2.2cqw 2.2cqw;
  border: 1px solid rgb(210 220 240 / .25);
  border-radius: .65cqw;
  background: rgb(8 13 25 / .8);
  backdrop-filter: blur(8px);
  color: #f4f6fc;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  animation: adv-dialogue-in .2s ease;
}
.adv-speaker {
  position: absolute;
  top: .8cqw; left: 2.2cqw;
  min-inline-size: 8cqw;
  padding-block-end: .3cqw;
  border-block-end: 1px solid rgb(160 190 230 / .5);
  color: #d9e6ff;
  font-size: 1.2cqw;
  font-weight: 600;
  letter-spacing: .12em;
}
.adv-text {
  flex: 1 1 auto; min-block-size: 0;
  overflow: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 1.55cqw;
  line-height: 1.65;
}
.adv-page-indicator { position: absolute; right: 2.2cqw; bottom: .8cqw; font-size: 1cqw; opacity: .65; }
.adv-choices { display: grid; gap: .625rem; }
.adv-choice {
  appearance: none; border: 1px solid rgb(255 255 255 / .28);
  border-radius: .5rem; padding: .7rem 1rem;
  background: rgb(255 255 255 / .09); color: inherit;
  font: inherit; text-align: left; cursor: pointer;
}
@keyframes adv-dialogue-in { from { opacity: 0; } to { opacity: 1; } }
`;
