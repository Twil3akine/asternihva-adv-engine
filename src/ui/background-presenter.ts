import type { BackgroundDefinition } from "../types.js";

export interface BackgroundPresenterOptions {
  transitionDuration?: number;
}

export class BackgroundPresenter {
  readonly #host: HTMLElement;
  readonly #loads = new Map<string, Promise<HTMLImageElement | undefined>>();
  readonly #duration: number;
  #image?: HTMLImageElement;
  #source?: string;
  #token = 0;
  #destroyed = false;
  #animationsEnabled = true;
  #fade?: { outgoing: HTMLImageElement; animations: Animation[] };

  constructor(host: HTMLElement, options: BackgroundPresenterOptions = {}) {
    this.#host = host;
    this.#duration = options.transitionDuration ?? 300;
    if (!Number.isFinite(this.#duration) || this.#duration < 0) {
      throw new Error("Background transitionDuration must be finite and non-negative.");
    }
  }

  setAnimationsEnabled(enabled: boolean): void {
    this.#animationsEnabled = enabled;
    if (!enabled) this.#cancelFade();
  }

  async set(background?: BackgroundDefinition): Promise<void> {
    if (this.#destroyed) return;
    const token = ++this.#token;
    if (!background) {
      this.#cancelFade();
      this.#image?.remove();
      this.#image = undefined;
      this.#source = undefined;
      this.#host.style.setProperty("--adv-background-overlay", "0");
      return;
    }
    const { anchorX = 0.5, anchorY = 0.5, overlay = 0 } = background;
    if (![anchorX, anchorY, overlay].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
      throw new Error("Background anchors and overlay must be between 0 and 1.");
    }
    if (background.src === this.#source) {
      this.#apply(this.#image!, anchorX, anchorY, overlay);
      return;
    }
    const image = await this.#load(background.src);
    if (!image || this.#destroyed || token !== this.#token) return;
    this.#cancelFade();
    const outgoing = this.#image;
    this.#image = image;
    this.#source = background.src;
    image.className = "adv-background-image";
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    this.#apply(image, anchorX, anchorY, overlay);
    this.#host.append(image);
    const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!outgoing || !this.#animationsEnabled || reducedMotion || this.#duration === 0 || !image.animate) {
      outgoing?.remove();
      return;
    }
    const timing = { duration: this.#duration, easing: "linear", fill: "both" } as const;
    const fade = { outgoing, animations: [
      image.animate([{ opacity: 0 }, { opacity: 1 }], timing),
      outgoing.animate([{ opacity: 1 }, { opacity: 0 }], timing),
    ] };
    this.#fade = fade;
    await Promise.all(fade.animations.map(animation => animation.finished.catch(() => {})));
    if (this.#fade === fade) this.#cancelFade();
  }

  async prefetch(background: BackgroundDefinition): Promise<void> {
    if (!this.#destroyed) await this.#load(background.src);
  }

  destroy(): void {
    this.#destroyed = true;
    this.#token++;
    this.#cancelFade();
    this.#image?.remove();
    this.#loads.clear();
  }

  #apply(image: HTMLImageElement, anchorX: number, anchorY: number, overlay: number): void {
    image.style.objectPosition = `${anchorX * 100}% ${anchorY * 100}%`;
    this.#host.style.setProperty("--adv-background-overlay", String(overlay));
  }

  #cancelFade(): void {
    if (!this.#fade) return;
    for (const animation of this.#fade.animations) animation.cancel();
    this.#fade.outgoing.remove();
    this.#fade = undefined;
  }

  #load(source: string): Promise<HTMLImageElement | undefined> {
    const cached = this.#loads.get(source);
    if (cached) return cached;
    const image = document.createElement("img");
    image.src = source;
    const load = image.decode().then(() => image, () => {
      this.#loads.delete(source);
      return undefined;
    });
    this.#loads.set(source, load);
    return load;
  }
}

export const backgroundPresenterCss = `
.adv-background-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; mix-blend-mode: plus-lighter; }
`;
