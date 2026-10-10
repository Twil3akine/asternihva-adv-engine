import { DecodedImageCache, type ImageCacheOptions, type ImageLease } from "../assets/decoded-image-cache.js";
import type {
  CharacterDefinition,
  CharacterRenderer,
  RenderedCharacter,
  StagePosition,
} from "../types.js";

export interface SpriteRendererOptions {
  className?: string;
  imageCache?: DecodedImageCache;
  assetCache?: ImageCacheOptions;
  /** Expression crossfade duration in milliseconds; 0 disables it. */
  crossfadeDuration?: number;
}

export interface SpriteAssets {
  expressions: Record<string, string>;
  motions?: Record<string, SpriteMotion>;
  displayMode?: SpriteDisplayMode;
  portrait?: SpritePortrait;
}

export type SpriteDisplayMode = "portrait" | "fullbody";

export interface SpritePortrait {
  /** Image width relative to the character viewport width. */
  scale?: number;
  /** Fraction of horizontal overflow to crop; defaults to 0.5 (center). */
  anchorX?: number;
  /** Fraction of vertical overflow to crop; defaults to 0 (top). */
  anchorY?: number;
}

export interface SpriteRenderedCharacter extends RenderedCharacter {
  setDisplayMode(mode: SpriteDisplayMode): void;
}

export type SpriteMotionKeyframe = {
  translate?: string;
  rotate?: string;
  scale?: string | number;
  opacity?: number;
  offset?: number;
  easing?: string;
};

export interface SpriteMotion {
  keyframes: SpriteMotionKeyframe[];
  duration?: number;
  easing?: string;
  iterations?: number;
  direction?: PlaybackDirection;
}

class SpriteCharacter implements SpriteRenderedCharacter {
  readonly #root: HTMLDivElement;
  readonly #visual: HTMLDivElement;
  readonly #image: HTMLImageElement;
  readonly #expressions: Record<string, string>;
  readonly #motions: Record<string, SpriteMotion>;
  readonly #cache: DecodedImageCache;
  #lease?: ImageLease;
  #source?: string;
  #expressionToken = 0;
  #initial: Promise<void>;
  #motion?: Animation;
  readonly #crossfadeDuration: number;
  #fade?: { outgoing: HTMLImageElement; animations: Animation[]; lease?: ImageLease };

  constructor(host: HTMLElement, character: CharacterDefinition, options: SpriteRendererOptions, cache: DecodedImageCache) {
    this.#cache = cache;
    this.#crossfadeDuration = options.crossfadeDuration ?? 180;
    const assets = character.assets?.expressions ?? character.assets ?? {};
    this.#expressions = Object.fromEntries(
      Object.entries(assets).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
    this.#motions = (character.assets?.motions ?? {}) as Record<string, SpriteMotion>;

    this.#root = document.createElement("div");
    this.#root.className = ["adv-sprite-character", options.className].filter(Boolean).join(" ");
    this.#root.dataset.character = character.id;
    this.#root.dataset.visible = "false";
    const portrait = (character.assets?.portrait ?? {}) as SpritePortrait;
    const scale = portrait.scale ?? 1;
    const anchorX = portrait.anchorX ?? 0.5;
    const anchorY = portrait.anchorY ?? 0;
    if (!Number.isFinite(scale) || scale <= 0 ||
        !Number.isFinite(anchorX) || !Number.isFinite(anchorY)) {
      throw new Error("Sprite portrait requires a positive finite scale and finite anchors.");
    }
    this.#root.style.setProperty("--adv-portrait-scale", String(scale));
    this.#root.style.setProperty("--adv-portrait-anchor-x", String(anchorX));
    this.#root.style.setProperty("--adv-portrait-anchor-y", String(anchorY));
    this.setDisplayMode((character.assets?.displayMode ??
      (character.assets?.portrait ? "portrait" : "fullbody")) as SpriteDisplayMode);

    this.#visual = document.createElement("div");
    this.#visual.className = "adv-sprite-visual";
    this.#root.append(this.#visual);
    this.#image = document.createElement("img");
    this.#image.alt = character.name;
    this.#image.draggable = false;
    this.#visual.append(this.#image);
    host.append(this.#root);

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
    const lease = await this.#cache.acquire(source);
    if (!lease) return;
    if (token !== this.#expressionToken) { lease.release(); return; }
    {
      this.#cancelFade();
      const previous = this.#source;
      const previousLease = this.#lease;
      this.#lease = lease;
      this.#image.src = source;
      this.#source = source;
      if (!previous || this.#crossfadeDuration === 0 || !this.#image.animate) { previousLease?.release(); return; }
      const outgoing = document.createElement("img");
      outgoing.src = previous;
      outgoing.alt = "";
      outgoing.setAttribute("aria-hidden", "true");
      this.#visual.append(outgoing);
      const timing = { duration: this.#crossfadeDuration, easing: "linear", fill: "both" } as const;
      const fade = {
        outgoing,
        lease: previousLease,
        animations: [
          this.#image.animate([{ opacity: 0 }, { opacity: 1 }], timing),
          outgoing.animate([{ opacity: 1 }, { opacity: 0 }], timing),
        ],
      };
      this.#fade = fade;
      await Promise.all(fade.animations.map((animation) => animation.finished.catch(() => {})));
      if (this.#fade === fade) this.#cancelFade();
    }
  }

  playMotion(name: string): void {
    const motion = Object.hasOwn(this.#motions, name) ? this.#motions[name] : undefined;
    if (!motion || !Array.isArray(motion.keyframes) || !this.#visual.animate) return;
    this.#motion?.cancel();
    const animation = this.#visual.animate(motion.keyframes, {
      duration: motion.duration ?? 500,
      easing: motion.easing ?? "ease",
      iterations: motion.iterations ?? 1,
      direction: motion.direction ?? "normal",
      fill: "none",
    });
    this.#motion = animation;
    void animation.finished.then(() => {
      if (this.#motion === animation) {
        animation.cancel();
        this.#motion = undefined;
      }
    }, () => {
      if (this.#motion === animation) this.#motion = undefined;
    });
  }

  stopMotion(): void {
    this.#motion?.cancel();
    this.#motion = undefined;
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

  setDisplayMode(mode: SpriteDisplayMode): void {
    if (mode !== "portrait" && mode !== "fullbody") {
      throw new Error(`Unknown sprite display mode: ${mode}`);
    }
    this.#root.dataset.displayMode = mode;
  }

  destroy(): void {
    this.#expressionToken += 1;
    this.#motion?.cancel();
    this.#cancelFade();
    this.#lease?.release();
    this.#lease = undefined;
    this.#root.remove();
  }

  #cancelFade(): void {
    if (!this.#fade) return;
    for (const animation of this.#fade.animations) animation.cancel();
    this.#fade.outgoing.remove();
    this.#fade.lease?.release();
    this.#fade = undefined;
  }


}

export class SpriteRenderer implements CharacterRenderer {
  readonly key = "sprite";
  readonly #options: SpriteRendererOptions;
  readonly #cache: DecodedImageCache;

  constructor(options: SpriteRendererOptions = {}) {
    if (options.crossfadeDuration !== undefined &&
        (!Number.isFinite(options.crossfadeDuration) || options.crossfadeDuration < 0)) {
      throw new Error("crossfadeDuration must be a finite, non-negative number.");
    }
    this.#options = options;
    this.#cache = options.imageCache ?? new DecodedImageCache(options.assetCache);
  }

  create(host: HTMLElement, character: CharacterDefinition): SpriteRenderedCharacter {
    return new SpriteCharacter(host, character, this.#options, this.#cache);
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
  filter: brightness(var(--adv-unfocus-brightness, .55));
  transition: opacity var(--adv-focus-duration, 200ms) ease, filter var(--adv-focus-duration, 200ms) ease;
  pointer-events: none;
  display: grid;
  place-items: end center;
}
.adv-sprite-character img {
  grid-area: 1 / 1;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 18px 30px rgb(0 0 0 / .28));
}
.adv-sprite-visual {
  isolation: isolate;
  position: relative;
  display: grid;
  place-items: end center;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  transform-origin: 50% 100%;
}
.adv-sprite-visual img {
  /* Add complementary fade weights without revealing the background. */
  mix-blend-mode: plus-lighter;
}
.adv-sprite-character[data-display-mode="portrait"] { overflow: hidden; }
.adv-sprite-character[data-display-mode="portrait"] img {
  position: absolute;
  width: calc(100% * var(--adv-portrait-scale));
  height: auto;
  max-width: none;
  max-height: none;
  left: calc(100% * var(--adv-portrait-anchor-x));
  top: calc(100% * var(--adv-portrait-anchor-y));
  transform: translate(
    calc(-100% * var(--adv-portrait-anchor-x)),
    calc(-100% * var(--adv-portrait-anchor-y))
  );
}
.adv-sprite-character[data-visible="true"] { opacity: var(--adv-unfocus-opacity, .82); }
.adv-sprite-character[data-active="true"] {
  filter: brightness(var(--adv-focus-brightness, 1));
}
.adv-sprite-character[data-visible="true"][data-active="true"] {
  opacity: var(--adv-focus-opacity, 1);
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
`;
