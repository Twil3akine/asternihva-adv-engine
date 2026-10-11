export type AudioChannel = "bgm" | "se" | "voice";
export interface AudioVolumes { master: number; bgm: number; se: number; voice: number; }
export const DEFAULT_AUDIO_VOLUMES: Readonly<AudioVolumes> = Object.freeze({ master: 1, bgm: 1, se: 1, voice: 1 });
export interface AudioPlayOptions { loop?: boolean; volume?: number; fadeInMs?: number; crossfadeMs?: number; }
export interface AudioStopOptions { fadeOutMs?: number; }
export interface AudioAdapter {
  play(channel: AudioChannel, id: string, options: AudioPlayOptions): void | Promise<void>;
  stop(channel: AudioChannel, options?: AudioStopOptions): void | Promise<void>;
  setVolume(channel: AudioChannel, volume: number): void;
  destroy(): void;
}
export interface BgmState { id: string; loop: boolean; volume: number; }
export interface LogicalAudioState { bgm?: BgmState; }
export function isAudioVolumes(value: unknown): value is AudioVolumes {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 4 && ["master", "bgm", "se", "voice"].every(k => typeof v[k] === "number" && Number.isFinite(v[k]) && (v[k] as number) >= 0 && (v[k] as number) <= 1);
}
export function validateAudioOptions(options: AudioPlayOptions & AudioStopOptions): void {
  if ((options.volume !== undefined && (!Number.isFinite(options.volume) || options.volume < 0 || options.volume > 1)) ||
    [options.fadeInMs, options.fadeOutMs, options.crossfadeMs].some(ms => ms !== undefined && (!Number.isFinite(ms) || ms < 0)) ||
    (options.loop !== undefined && typeof options.loop !== "boolean")) throw new TypeError("Invalid audio options.");
}
/** Logical audio state; no browser globals, audio buffers or playback positions. */
export class AudioController {
  #volumes: Readonly<AudioVolumes> = DEFAULT_AUDIO_VOLUMES;
  #bgm?: BgmState;
  #generation = 0;
  #destroyed = false;
  constructor(readonly adapter: AudioAdapter, readonly stopVoiceOnLineChange = true) { this.setVolumes(DEFAULT_AUDIO_VOLUMES); }
  get volumes(): Readonly<AudioVolumes> { return this.#volumes; }
  setVolumes(volumes: AudioVolumes): void {
    if (!isAudioVolumes(volumes)) throw new TypeError("Audio volumes must be finite values from 0 to 1.");
    this.#volumes = Object.freeze({ ...volumes });
    for (const channel of ["bgm", "se", "voice"] as const) this.adapter.setVolume(channel, volumes.master * volumes[channel]);
  }
  async play(channel: AudioChannel, id: string, options: AudioPlayOptions = {}): Promise<void> {
    if (this.#destroyed) throw new Error("Audio controller is destroyed.");
    if (!id.trim()) throw new TypeError("Audio ID is required.");
    validateAudioOptions(options);
    const generation = channel === "bgm" ? ++this.#generation : this.#generation;
    const normalized = { ...options, loop: options.loop ?? channel === "bgm", volume: options.volume ?? 1 };
    await this.adapter.play(channel, id, normalized);
    if (channel === "bgm" && generation === this.#generation && !this.#destroyed) this.#bgm = { id, loop: normalized.loop, volume: normalized.volume };
  }
  async stop(channel: AudioChannel, options: AudioStopOptions = {}): Promise<void> {
    validateAudioOptions(options);
    const generation = channel === "bgm" ? ++this.#generation : this.#generation;
    await this.adapter.stop(channel, options);
    if (channel === "bgm" && generation === this.#generation) this.#bgm = undefined;
  }
  lineChanged(): Promise<void> { return this.stopVoiceOnLineChange ? this.stop("voice") : Promise.resolve(); }
  snapshot(): LogicalAudioState { return this.#bgm ? { bgm: { ...this.#bgm } } : {}; }
  async restore(state: LogicalAudioState = {}): Promise<void> {
    await this.stop("voice"); await this.stop("se"); await this.stop("bgm");
    if (state.bgm) await this.play("bgm", state.bgm.id, state.bgm);
  }
  destroy(): void { if (this.#destroyed) return; this.#destroyed = true; ++this.#generation; this.#bgm = undefined; this.adapter.destroy(); }
}
