import { validateScenarios } from "../dist/tooling/scenario-validator.js";
import { loadLocalScenarios } from "../examples/asternihva/local-scenarios.mjs";
import { assetManifest } from "../examples/asternihva/asset-manifest.mjs";
import { backgroundManifest } from "../examples/asternihva/background-manifest.mjs";
import { stageLayoutManifest } from "../examples/asternihva/stage-layout-manifest.mjs";
import { motions } from "../examples/asternihva/motions.mjs";

try {
  const scenarios = await loadLocalScenarios();
  const characters = assetManifest.map(character => ({
    id: character.id, name: character.name, renderer: "sprite",
    defaultExpression: character.defaultExpression,
    assets: { expressions: character.expressions, motions },
  }));
  const entries = scenarios.map(definition => ({
    ...definition.scenario,
    entry: { characters, backgrounds: backgroundManifest, stageLayouts: stageLayoutManifest, ...definition },
  }));
  const result = validateScenarios(entries);
  for (const entry of entries) {
    const diagnostics = result.diagnostics.filter(item => item.scenarioId === entry.id);
    console.log(`${diagnostics.some(item => item.severity === "error") ? "✗" : "✓"} ${entry.chapter ?? entry.id}`);
    for (const diagnostic of diagnostics) console.log(`  ${diagnostic.severity.toUpperCase()} ${diagnostic.location ?? "catalog"}: ${diagnostic.message}`);
  }
  console.log(`Errors: ${result.errors}\nWarnings: ${result.warnings}`);
  process.exitCode = result.errors ? 1 : 0;
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
