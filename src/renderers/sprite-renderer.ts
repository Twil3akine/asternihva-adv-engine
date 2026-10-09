import type {
  CharacterDefinition,
  CharacterRenderer,
  RenderedCharacter,
  StagePosition,
} from "../types.js";

export interface SpriteRendererOptions {
  className?: string;
}

export interface SpriteAssets {
  expressions: Record<string, string>;
}

const BUILTIN_MOTIONS = new Set(["bounce", "nod", "shake", "pulse"]);

class SpriteCharacter implements RenderedCharacter {
  readonly #root: HTMLDivElement;
  readonly #image: HTMLImageElement;
  readonly #character: CharacterDefinition;
  readonly #expressions: Record<string, string>;
  readonly #loads = new Map<string, Promise<boolean>>();
  #source?: string;
  #expressionToken = 0;
  #initial: Promise<void>;
  #motionToken = 0;

  constructor(host: HTMLElement, character: CharacterDefinition, className?: string) {
    this.#character = character;
    const assets = character.assets?.expressions ?? character.assets ?? {};
    this.#expressions = Object.fromEntries(
      Object.entries(assets).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );

    this.#root = document.createElement("div");
    this.#root.className = ["adv-sprite-character", className].filter(Boolean).join(" ");
    this.#root.dataset.character = character.id;
    this.#root.dataset.visible = "false";

    this.#image = document.createElement("img");
    this.#image.alt = character.name;
    this.#image.draggable = false;
    this.#root.append(this.#image);
    host.append(this.#root);

    for (const source of Object.values(this.#expressions)) this.#load(source);
    const initial = [character.defaultExpression, "normal", "default"]
      .find((name) => name !== undefined && this.#expressions[name]);
    this.#initial = this.setExpression(initial ?? Object.keys(this.#expressions)[0] ?? "");
  }

  async show(): Promise<void> {
    await this.#initial;
    this.#root.dataset.visible = "true";
  }

  hide(): void {
    this.#root.dataset.visible = "false";
  }

  async setExpression(name: string): Promise<void> {
    const source = Object.hasOwn(this.#expressions, name) ? this.#expressions[name] : undefined;
    if (!source) return;
    const token = ++this.#expressionToken;
    if (source === this.#source) return;
    if (await this.#load(source) && token === this.#expressionToken) {
      this.#image.src = source;
      this.#source = source;
    }
  }

  playMotion(name: string): void {
    if (!BUILTIN_MOTIONS.has(name)) {
      this.#root.dispatchEvent(
        new CustomEvent("adv:motion", {
          bubbles: true,
          detail: { character: this.#character.id, motion: name },
        }),
      );
      return;
    }

    const token = ++this.#motionToken;
    this.#root.dataset.motion = "";
    // Force layout so playing the same motion twice restarts the animation.
    void this.#root.offsetWidth;
    this.#root.dataset.motion = name;

    window.setTimeout(() => {
      if (token === this.#motionToken) this.#root.dataset.motion = "";
    }, 720);
  }

  setPosition(position: StagePosition): void {
    if (typeof position === "string") {
      this.#root.dataset.position = position;
      this.#root.style.removeProperty("--adv-x");
      this.#root.style.removeProperty("--adv-y");
      this.#root.style.removeProperty("--adv-scale");
      this.#root.style.removeProperty("z-index");
      return;
    }

    this.#root.dataset.position = "custom";
    this.#root.style.setProperty("--adv-x", `${position.x}%`);
    this.#root.style.setProperty("--adv-y", `${position.y ?? 0}%`);
    this.#root.style.setProperty("--adv-scale", String(position.scale ?? 1));
    if (position.zIndex !== undefined) {
      this.#root.style.zIndex = String(position.zIndex);
    } else {
      this.#root.style.removeProperty("z-index");
    }
  }

  setActive(active: boolean): void {
    this.#root.dataset.active = String(active);
  }

  destroy(): void {
    this.#expressionToken += 1;
    this.#root.remove();
  }

  #load(source: string): Promise<boolean> {
    const cached = this.#loads.get(source);
    if (cached) return cached;
    const image = document.createElement("img");
    image.src = source;
    const loaded = image.decode().then(() => true, () => false);
    this.#loads.set(source, loaded);
    return loaded;
  }
}

export class SpriteRenderer implements CharacterRenderer {
  readonly key = "sprite";
  readonly #options: SpriteRendererOptions;

  constructor(options: SpriteRendererOptions = {}) {
    this.#options = options;
  }

  create(host: HTMLElement, character: CharacterDefinition): RenderedCharacter {
    return new SpriteCharacter(host, character, this.#options.className);
  }
}

export const spriteRendererCss = `
.adv-sprite-character {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: min(36vw, 430px);
  height: 92%;
  transform: translateX(-50%);
  transform-origin: 50% 100%;
  opacity: 0;
  filter: brightness(.72) saturate(.8);
  transition: opacity .28s ease, filter .28s ease, transform .35s cubic-bezier(.2,.8,.2,1);
  pointer-events: none;
  display: grid;
  place-items: end center;
}
.adv-sprite-character img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 18px 30px rgb(0 0 0 / .28));
}
.adv-sprite-character[data-visible="true"] { opacity: 1; }
.adv-sprite-character[data-active="true"] {
  filter: brightness(1) saturate(1);
  transform: translateX(-50%) translateY(-1.5%) scale(1.025);
}
.adv-sprite-character[data-position="far-left"] { left: 10%; }
.adv-sprite-character[data-position="left"] { left: 28%; }
.adv-sprite-character[data-position="center"] { left: 50%; }
.adv-sprite-character[data-position="right"] { left: 72%; }
.adv-sprite-character[data-position="far-right"] { left: 90%; }
.adv-sprite-character[data-position="custom"] {
  left: var(--adv-x);
  bottom: var(--adv-y);
  transform: translateX(-50%) scale(var(--adv-scale));
}
.adv-sprite-character[data-motion="bounce"] { animation: adv-bounce .62s ease; }
.adv-sprite-character[data-motion="nod"] { animation: adv-nod .58s ease; }
.adv-sprite-character[data-motion="shake"] { animation: adv-shake .48s ease; }
.adv-sprite-character[data-motion="pulse"] { animation: adv-pulse .62s ease; }
@keyframes adv-bounce { 0%,100%{margin-bottom:0} 42%{margin-bottom:24px} 68%{margin-bottom:5px} }
@keyframes adv-nod { 0%,100%{rotate:0deg} 45%{rotate:2deg} 70%{rotate:-.5deg} }
@keyframes adv-shake { 0%,100%{margin-left:0} 25%{margin-left:-13px} 50%{margin-left:12px} 75%{margin-left:-6px} }
@keyframes adv-pulse { 0%,100%{scale:1} 50%{scale:1.035} }
`;
