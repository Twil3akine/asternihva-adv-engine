import type { StageLayoutDefinition, StageLayoutPreset } from "./types.js";

const presetPositions: Record<Exclude<StageLayoutPreset, "narration">, readonly { x: number; scale?: number }[]> = {
  trio: [{ x: 20 }, { x: 50 }, { x: 80 }],
  "duo-left": [{ x: 28 }, { x: 48 }],
  "duo-right": [{ x: 52 }, { x: 72 }],
  "solo-center": [{ x: 50 }],
  "solo-close": [{ x: 50, scale: 1.08 }],
};

/** Build a renderer-agnostic stage arrangement for caller-supplied character ids. */
export function createStageLayoutPreset(
  preset: StageLayoutPreset,
  characterIds: readonly string[],
): StageLayoutDefinition {
  if (!characterIds.length || characterIds.some((id) => !id)) {
    throw new Error("A stage layout preset requires at least one character id.");
  }

  const positions = preset === "narration"
    ? characterIds.length === 1 ? [{ x: 50 }]
      : characterIds.length === 2 ? [{ x: 35 }, { x: 65 }]
        : characterIds.length === 3 ? [{ x: 22 }, { x: 50 }, { x: 78 }]
          : undefined
    : presetPositions[preset];

  if (!positions || characterIds.length !== positions.length) {
    throw new Error(`Stage layout preset "${preset}" does not support ${characterIds.length} characters.`);
  }

  return {
    hideOthers: true,
    members: characterIds.map((character, index) => ({
      character,
      position: positions[index],
      show: true,
    })),
  };
}
