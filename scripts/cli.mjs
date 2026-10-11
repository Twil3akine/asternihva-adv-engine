#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildAssets, validateAssetManifest } from "../dist/tooling/index.js";

const [command, subcommand, manifestPath, outDir, ...extra] = process.argv.slice(2);
try {
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
} catch (error) { console.error(error.message); process.exitCode = 1; }
