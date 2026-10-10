import { createStageLayoutPreset } from "../../dist/index.js";

export const stageLayoutManifest = {
  trio: createStageLayoutPreset("trio", ["noah", "seren", "luminal"]),
  "duo-noah-seren": createStageLayoutPreset("duo-left", ["noah", "seren"]),
  "duo-seren-luminal": createStageLayoutPreset("duo-right", ["seren", "luminal"]),
  "solo-noah": createStageLayoutPreset("solo-center", ["noah"]),
  "solo-seren-close": createStageLayoutPreset("solo-close", ["seren"]),
  narration: createStageLayoutPreset("narration", ["noah", "seren", "luminal"]),
  "background-only": { hideOthers: true, members: [] },
};
