export type AutoSpeed = "slow" | "normal" | "fast";

export interface GameSettings {
  autoSpeed: AutoSpeed;
  characterMotion: boolean;
  uiAnimation: boolean;
}

export const DEFAULT_GAME_SETTINGS: Readonly<GameSettings> = Object.freeze({
  autoSpeed: "normal",
  characterMotion: true,
  uiAnimation: true,
});

export const AUTO_SPEED_MULTIPLIERS: Readonly<Record<AutoSpeed, number>> = Object.freeze({
  slow: 1.3,
  normal: 1,
  fast: 0.7,
});

const STORAGE_KEY = "web-adv-engine:settings:v1";

type SettingsStorage = Pick<Storage, "getItem" | "setItem">;
type SettingsListener = (settings: Readonly<GameSettings>) => void;

function isSettings(value: unknown): value is GameSettings {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return Object.keys(candidate).length === 3
    && (candidate.autoSpeed === "slow" || candidate.autoSpeed === "normal" || candidate.autoSpeed === "fast")
    && typeof candidate.characterMotion === "boolean"
    && typeof candidate.uiAnimation === "boolean";
}

function snapshot(settings: GameSettings): Readonly<GameSettings> {
  return Object.freeze({ ...settings });
}

export function getAutoDelayMultiplier(settings: Pick<GameSettings, "autoSpeed">): number {
  return AUTO_SPEED_MULTIPLIERS[settings.autoSpeed];
}

export class GameSettingsStore {
  private settings: Readonly<GameSettings>;
  private readonly listeners = new Set<SettingsListener>();

  constructor(
    private readonly storage?: SettingsStorage,
    private readonly key = STORAGE_KEY,
  ) {
    this.settings = this.load();
  }

  get value(): Readonly<GameSettings> {
    return this.settings;
  }

  update(patch: Partial<GameSettings>): Readonly<GameSettings> {
    if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
      throw new TypeError("Settings patch must be an object.");
    }

    const keys = Object.keys(patch);
    if (keys.some(key => key !== "autoSpeed" && key !== "characterMotion" && key !== "uiAnimation")) {
      throw new TypeError("Settings patch contains an unsupported setting.");
    }

    const next = { ...this.settings, ...patch };
    if (!isSettings(next)) {
      throw new TypeError("Settings patch contains an invalid value.");
    }

    if (next.autoSpeed === this.settings.autoSpeed
      && next.characterMotion === this.settings.characterMotion
      && next.uiAnimation === this.settings.uiAnimation) {
      return this.settings;
    }

    this.settings = snapshot(next);
    this.save();
    for (const listener of this.listeners) listener(this.settings);
    return this.settings;
  }

  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private load(): Readonly<GameSettings> {
    try {
      const stored = this.storage?.getItem(this.key);
      if (stored === null || stored === undefined) return DEFAULT_GAME_SETTINGS;

      const envelope: unknown = JSON.parse(stored);
      if (typeof envelope !== "object" || envelope === null) return DEFAULT_GAME_SETTINGS;
      const candidate = envelope as Record<string, unknown>;
      if (candidate.version !== 1 || !isSettings(candidate.settings)) return DEFAULT_GAME_SETTINGS;
      return snapshot(candidate.settings);
    } catch {
      return DEFAULT_GAME_SETTINGS;
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(this.key, JSON.stringify({ version: 1, settings: this.settings }));
    } catch {
      // Storage may be unavailable or full; settings remain usable for this session.
    }
  }
}
