export interface AutoConfig {
  baseDelayMs: number;
  perCharacterMs: number;
  punctuationDelayMs: number;
  minDelayMs: number;
  maxDelayMs: number;
}

export const defaultAutoConfig: Readonly<AutoConfig> = Object.freeze({
  baseDelayMs: 900,
  perCharacterMs: 60,
  punctuationDelayMs: 180,
  minDelayMs: 1200,
  maxDelayMs: 12000,
});

/** Supply the visible page, not the complete scenario line. */
export function calculateAutoDelay(text: string, options: Partial<AutoConfig> = {}, minimumDurationMs = 0): number {
  const config = { ...defaultAutoConfig, ...options };
  if (Object.values(config).some(value => !Number.isFinite(value) || value < 0) || config.minDelayMs > config.maxDelayMs || !Number.isFinite(minimumDurationMs) || minimumDurationMs < 0) {
    throw new Error("AUTO delays must be finite and non-negative, with minDelayMs <= maxDelayMs.");
  }
  const characters = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)]
    .filter(({ segment }) => segment.trim()).length;
  const pauses = [...text.matchAll(/\r\n|[\r\n]|[.…]{2,}|…|[。.!！？?]/gu)].length;
  const textDelay = config.baseDelayMs + characters * config.perCharacterMs + pauses * config.punctuationDelayMs;
  // A caller can provide a minimum duration without coupling this utility to media.
  return Math.max(minimumDurationMs, Math.round(Math.min(config.maxDelayMs, Math.max(config.minDelayMs, textDelay))));
}
