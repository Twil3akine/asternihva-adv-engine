#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildAssets, validateAssetManifest, validateScenarios, scenarioStatistics, scenarioGraph, scenarioGraphDot } from "../dist/tooling/index.js";

const [command, subcommand, manifestPath, outDir, ...extra] = process.argv.slice(2);
try {
  if (command === "scenario") {
    if (!["validate", "stats", "graph"].includes(subcommand) || !manifestPath) throw new Error("Usage: asternihva-adv-engine scenario <validate|stats|graph> <module.mjs> [--lint|out.json|out.dot]");
    // Scenario modules are trusted executable JavaScript. No module text is printed.
    const module = await import(pathToFileURL(resolve(manifestPath)).href);
    const exported = module.default ?? module.scenarios ?? Object.values(module).filter(v => v && typeof v === "object" && (v.entry || v.scenes));
    const definitions = Array.isArray(exported) ? exported : [exported];
    const entries = definitions.map((value, i) => value.entry ? value : ({ id: value.scenario?.id ?? `scenario-${i}`, ...value.scenario, entry: { characters: [], ...value } }));
    if (subcommand === "validate") {
      if ((outDir && outDir !== "--lint") || extra.length) throw new Error("Validation only accepts --lint.");
      const result = validateScenarios(entries, { lint: outDir === "--lint" });
      console.log(JSON.stringify({ valid: result.valid, errors: result.errors, warnings: result.warnings,
        scenarios: entries.map(e => { const ds=result.diagnostics.filter(d=>d.scenarioId===e.id); return {id:e.id, errors:ds.filter(d=>d.severity==='error').length,warnings:ds.filter(d=>d.severity==='warning').length}; }) }, null, 2));
      process.exitCode = result.valid ? 0 : 1;
    } else if (subcommand === "stats") {
      if (outDir || extra.length) throw new Error("Statistics takes one module path.");
      console.log(JSON.stringify(entries.map(e => ({id:e.id, ...scenarioStatistics(e.entry)})), null, 2));
    } else {
      if (!outDir || extra.length || entries.length !== 1 || !/\.(json|dot)$/.test(outDir)) throw new Error("Graph requires one scenario and an output .json or .dot path.");
      await writeFile(outDir, outDir.endsWith(".dot") ? scenarioGraphDot(entries[0].entry) : JSON.stringify(scenarioGraph(entries[0].entry), null, 2) + "\n");
      console.log("Scenario graph written.");
    }
  } else {
  if (command !== "asset" || subcommand !== "build" || !manifestPath || !outDir || extra.length) {
    throw new Error("Usage: asternihva-adv-engine asset build <manifest.json> <out-dir>");
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateAssetManifest(manifest);
  let sharp;
  try { sharp = (await import("sharp")).default; } catch { throw new Error("Asset conversion requires the optional peer: npm install sharp"); }
  const transformer = {
    version: `sharp:${JSON.stringify(sharp.versions)}`,
    async transform(input, options) {
      return sharp(input).rotate().resize({ width: options.maxWidth, height: options.maxHeight, fit: "inside", withoutEnlargement: true })
        .toFormat(options.format).toBuffer();
    },
  };
  const result = await buildAssets({ manifest, baseDir: dirname(resolve(manifestPath)), outDir, transformer });
  console.log(JSON.stringify({ built: result.built, skipped: result.skipped, stale: result.stale }, null, 2));
  }
} catch (error) { console.error(command === "scenario" ? "Scenario tooling failed; inspect the trusted module locally." : error.message); process.exitCode = 1; }
