import { DecodedImageCache, type ImageCacheOptions, type ImageLease } from "../assets/decoded-image-cache.js";
import type { BackgroundDefinition } from "../types.js";

export interface BackgroundPresenterOptions {
  transitionDuration?: number;
  imageCache?: DecodedImageCache;
  assetCache?: ImageCacheOptions;
}

export class BackgroundPresenter {
  readonly #host: HTMLElement;
  readonly #visual: HTMLDivElement;
  readonly #cache: DecodedImageCache;
  #lease?: ImageLease;
  readonly #duration: number;
  #image?: HTMLImageElement;
  #source?: string;
  #token = 0;
  #destroyed = false;
  #animationsEnabled = true;
  #fade?: { outgoing: HTMLImageElement; animations: Animation[]; lease?: ImageLease };

  constructor(host: HTMLElement, options: BackgroundPresenterOptions = {}) {
    this.#host = host;
    this.#cache = options.imageCache ?? new DecodedImageCache(options.assetCache);
    this.#duration = options.transitionDuration ?? 300;
    if (!Number.isFinite(this.#duration) || this.#duration < 0) {
      throw new Error("Background transitionDuration must be finite and non-negative.");
    }
    this.#visual = document.createElement("div");
    this.#visual.className = "adv-background-visual";
    host.append(this.#visual);
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
      this.#lease?.release();
      this.#lease = undefined;
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
    const lease = await this.#cache.acquire(background.src);
    if (!lease) return;
    if (this.#destroyed || token !== this.#token) { lease.release(); return; }
    const image = document.createElement("img");
    image.src = background.src;
    this.#cancelFade();
    const outgoing = this.#image;
    const previousLease = this.#lease;
    this.#lease = lease;
    this.#image = image;
    this.#source = background.src;
    image.className = "adv-background-image";
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    this.#apply(image, anchorX, anchorY, overlay);
    this.#visual.append(image);
    const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!outgoing || !this.#animationsEnabled || reducedMotion || this.#duration === 0 || !image.animate) {
      outgoing?.remove();
      previousLease?.release();
      return;
    }
    const timing = { duration: this.#duration, easing: "linear", fill: "both" } as const;
    const fade = { outgoing, lease: previousLease, animations: [
      image.animate([{ opacity: 0 }, { opacity: 1 }], timing),
      outgoing.animate([{ opacity: 1 }, { opacity: 0 }], timing),
    ] };
    this.#fade = fade;
    await Promise.all(fade.animations.map(animation => animation.finished.catch(() => {})));
    if (this.#fade === fade) this.#cancelFade();
  }

  async prefetch(background: BackgroundDefinition): Promise<void> {
    if (!this.#destroyed) await this.#cache.prefetch(background.src);
  }

  destroy(): void {
    this.#destroyed = true;
    this.#token++;
    this.#cancelFade();
    this.#image?.remove();
    this.#visual.remove();
    this.#lease?.release();
    this.#lease = undefined;
  }

  #apply(image: HTMLImageElement, anchorX: number, anchorY: number, overlay: number): void {
    image.style.objectPosition = `${anchorX * 100}% ${anchorY * 100}%`;
    this.#host.style.setProperty("--adv-background-overlay", String(overlay));
  }

  #cancelFade(): void {
    if (!this.#fade) return;
    for (const animation of this.#fade.animations) animation.cancel();
    this.#fade.outgoing.remove();
    this.#fade.lease?.release();
    this.#fade = undefined;
  }


}

export const backgroundPresenterCss = `
.adv-background-visual { position: absolute; inset: 0; isolation: isolate; }
.adv-background-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; mix-blend-mode: plus-lighter; }
`;
