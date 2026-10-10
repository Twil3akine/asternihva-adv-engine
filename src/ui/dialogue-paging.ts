/** Find a page boundary using the presentation's actual layout measurement. */
export function fitDialoguePage(text: string, start: number, fits: (candidate: string) => boolean): number {
  if (start >= text.length) return text.length;
  const remaining = text.slice(start);
  const segments = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(remaining)];
  const ends = segments.map(segment => start + segment.index + segment.segment.length);
  let low = 0, high = ends.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(text.slice(start, ends[middle - 1]!))) low = middle;
    else high = middle - 1;
  }
  if (low === ends.length) return text.length;
  let end = ends[Math.max(1, low) - 1]!;
  // Prefer a nearby word boundary without wasting most of the measured page.
  const limit = end;
  const minimum = start + (end - start) * 0.8;
  for (const word of new Intl.Segmenter(undefined, { granularity: "word" }).segment(remaining)) {
    const boundary = start + word.index + word.segment.length;
    if (boundary > limit) break;
    if (boundary >= minimum) end = boundary;
  }
  // Keep Japanese closing punctuation with the previous phrase when possible.
  const closing = /^[、。，．！？!?）」』】〕〉》ー々]/u;
  const opening = /[（「『【〔〈《]$/u;
  while (end > ends[0]! && (closing.test(text.slice(end)) || opening.test(text.slice(start, end)))) {
    end = ends[ends.indexOf(end) - 1] ?? ends[0]!;
  }
  return end;
}
