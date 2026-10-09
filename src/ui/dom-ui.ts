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
    this.#elements.root.dataset.mode = "line";

    return new Promise((resolve) => {
      const target = this.#elements.advanceTarget ?? this.#elements.root;
      const controller = new AbortController();
      const finish = () => {
        controller.abort();
        this.#cleanup = undefined;
        resolve();
      };

      target.addEventListener("click", finish, { signal: controller.signal });
      window.addEventListener(
        "keydown",
        (event) => {
          if (["Enter", " ", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
            finish();
          }
        },
        { signal: controller.signal },
      );
      this.#cleanup = () => controller.abort();
    });
  }

  presentChoice(choice: ChoicePresentation): Promise<number> {
    this.#cancelPending();
    this.#elements.speaker.hidden = true;
    this.#elements.text.textContent = choice.prompt ?? "";
    this.#elements.choices.replaceChildren();
    this.#elements.root.dataset.mode = "choice";

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
  left: max(24px, 6vw);
  right: max(24px, 6vw);
  bottom: max(24px, 4vh);
  min-height: 140px;
  padding: 32px 38px 26px;
  border: 1px solid rgb(255 255 255 / .32);
  border-radius: 24px;
  background: rgb(10 13 30 / .82);
  backdrop-filter: blur(22px) saturate(1.2);
  box-shadow: 0 26px 70px rgb(0 0 0 / .28);
  color: white;
}
.adv-speaker {
  position: absolute;
  top: -16px;
  left: 24px;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgb(110 111 190 / .94);
  font-weight: 700;
  letter-spacing: .04em;
}
.adv-text { font-size: clamp(18px, 2.1vw, 28px); line-height: 1.75; }
.adv-choices { display: grid; gap: 10px; margin-top: 18px; }
.adv-choice {
  appearance: none;
  border: 1px solid rgb(255 255 255 / .28);
  border-radius: 14px;
  padding: 13px 17px;
  background: rgb(255 255 255 / .09);
  color: white;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform .15s ease, background .15s ease;
}
.adv-choice:hover { transform: translateX(6px); background: rgb(255 255 255 / .16); }
`;
