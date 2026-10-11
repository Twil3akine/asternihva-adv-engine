import { validateAudioOptions, type AudioAdapter, type AudioChannel, type AudioPlayOptions, type AudioStopOptions } from "../audio.js";
export interface BrowserAudioOptions {
  assets: Readonly<Record<string, string>>;
  createContext?: () => AudioContext;
  load?: (url: string) => Promise<ArrayBuffer>;
}
interface Track { source: AudioBufferSourceNode; gain: GainNode; channel: AudioChannel; volume: number; stopping: boolean; }
/** Lazy Web Audio adapter. Call unlock() from a user gesture to allow playback. */
export class BrowserAudioAdapter implements AudioAdapter {
  #context?: AudioContext;
  #destroyed = false;
  #buffers = new Map<string, Promise<AudioBuffer>>();
  #tracks = new Set<Track>();
  #generations: Record<AudioChannel, number> = { bgm: 0, se: 0, voice: 0 };
  #volumes: Record<AudioChannel, number> = { bgm: 1, se: 1, voice: 1 };
  constructor(readonly options: BrowserAudioOptions) {}
  #getContext(): AudioContext {
    if (this.#destroyed) throw new Error("Audio adapter is destroyed.");
    return this.#context ??= this.options.createContext?.() ?? new AudioContext();
  }
  async unlock(): Promise<void> { await this.#getContext().resume(); }
  #buffer(id: string): Promise<AudioBuffer> {
    const source = Object.hasOwn(this.options.assets, id) ? this.options.assets[id] : undefined;
    if (!source) return Promise.reject(new Error("Unknown audio asset."));
    let pending = this.#buffers.get(id);
    if (!pending) {
      const context = this.#getContext();
      pending = (this.options.load ? this.options.load(source) : fetch(source).then(response => {
        if (!response.ok) throw new Error("Audio asset request failed."); return response.arrayBuffer();
      })).then(bytes => context.decodeAudioData(bytes));
      this.#buffers.set(id, pending);
      void pending.catch(() => { if (this.#buffers.get(id) === pending) this.#buffers.delete(id); });
    }
    return pending;
  }
  async play(channel: AudioChannel, id: string, options: AudioPlayOptions = {}): Promise<void> {
    validateAudioOptions(options);
    const token = channel === "se" ? this.#generations[channel] : ++this.#generations[channel];
    const buffer = await this.#buffer(id);
    if (this.#destroyed || token !== this.#generations[channel]) return;
    const context = this.#getContext(), source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; source.loop = options.loop ?? channel === "bgm";
    const track: Track = { source, gain, channel, volume: options.volume ?? 1, stopping: false };
    const previous = [...this.#tracks].filter(t => t.channel === channel);
    const crossfade = channel === "bgm" ? options.crossfadeMs ?? 0 : 0;
    if (channel !== "se") for (const old of previous) this.#stopTrack(old, crossfade);
    source.connect(gain); gain.connect(context.destination);
    const duration = Math.max(options.fadeInMs ?? 0, crossfade) / 1000;
    gain.gain.setValueAtTime(duration ? 0 : this.#volumes[channel] * track.volume, context.currentTime);
    if (duration) gain.gain.linearRampToValueAtTime(this.#volumes[channel] * track.volume, context.currentTime + duration);
    this.#tracks.add(track);
    source.onended = () => { this.#tracks.delete(track); source.disconnect(); gain.disconnect(); };
    try { source.start(); } catch (error) { this.#tracks.delete(track); source.disconnect(); gain.disconnect(); throw error; }
  }
  #stopTrack(track: Track, milliseconds: number): void {
    if (track.stopping) return;
    track.stopping = true;
    const now = this.#context!.currentTime;
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(track.gain.gain.value, now);
    if (milliseconds) track.gain.gain.linearRampToValueAtTime(0, now + milliseconds / 1000);
    try { track.source.stop(now + milliseconds / 1000); } catch { this.#tracks.delete(track); }
  }
  stop(channel: AudioChannel, options: AudioStopOptions = {}): void {
    validateAudioOptions(options); ++this.#generations[channel];
    for (const track of this.#tracks) if (track.channel === channel) this.#stopTrack(track, options.fadeOutMs ?? 0);
  }
  setVolume(channel: AudioChannel, volume: number): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new TypeError("Invalid audio volume.");
    this.#volumes[channel] = volume;
    for (const track of this.#tracks) if (track.channel === channel && !track.stopping) {
      const now = this.#context!.currentTime;
      track.gain.gain.cancelScheduledValues(now); track.gain.gain.setValueAtTime(volume * track.volume, now);
    }
  }
  destroy(): void {
    if (this.#destroyed) return;
    for (const channel of ["bgm", "se", "voice"] as const) this.stop(channel);
    this.#destroyed = true; this.#buffers.clear();
    void this.#context?.close().catch(() => {});
  }
}
