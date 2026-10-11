import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const temporary = await mkdtemp(join(tmpdir(), "asternihva-engine-pack-"));

try {
  const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", temporary], {
    cwd: root,
    env: { ...process.env, npm_config_cache: join(temporary, "npm-cache") },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }))[0];
  const tarball = join(temporary, packed.filename);
  const names = packed.files.map((file) => file.path);

  for (const required of ["package.json", "README.md", "LICENSE", "dist/index.js", "dist/core.js", "dist/web.js", "dist/live2d.js", "dist/tooling/scenario-validator.js"]) {
    assert(names.includes(required), `package is missing ${required}`);
  }
  for (const path of names) {
    assert(!/(^|\/)ep0[012](?:-scenario)?\.mjs$/i.test(path), `private scenario file was packed: ${path}`);
    assert(!/(^|\/)(scenario|examples|screenshots|\.codex-night-run)(\/|$)/i.test(path), `private or local path was packed: ${path}`);
    assert(!/\.(png|jpe?g|webp|woff2?|ttf|otf|log|svg|avif|mp3|ogg|wav|flac|mp4|mov)$/i.test(path), `local asset or log was packed: ${path}`);
  }

  const extraction = join(temporary, "unpacked");
  execFileSync("tar", ["-xzf", tarball, "-C", temporary]);
  const packageDir = join(temporary, "package");
  assert((await stat(packageDir)).isDirectory());
  const filesToScan = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await collect(path);
      else filesToScan.push(path);
    }
  }
  await collect(packageDir);
  const storyText = [];
  try {
    const directory = process.env.ADV_PRIVATE_SCENARIO_DIR;
    const definitions = directory ? await Promise.all(["ep00", "ep01", "ep02"].map(async id => (await import(pathToFileURL(resolve(directory, `${id}.mjs`)).href))[id]))
      : await (await import("../examples/asternihva/local-scenarios.mjs")).loadLocalScenarios();
    for (const definition of definitions) {
      for (const node of Object.values(definition.scenes).flat()) {
        if (node.text?.length >= 4) storyText.push(node.text);
        if (node.prompt?.length >= 4) storyText.push(node.prompt);
        for (const option of node.options ?? []) if (option.text.length >= 4) storyText.push(option.text);
      }
    }
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    // Public checkouts do not contain private stories.
  }
  const fragments = new Set(storyText);
  for (const text of storyText) {
    const chars = [...text];
    for (let index = 0; index + 24 <= chars.length; index += 12) fragments.add(chars.slice(index, index + 24).join(""));
  }
  const privateText = /\b(Noah|Seren|Luminal)\b|room-night-wide|room-night-window/i;
  for (const path of filesToScan) {
    const contents = await readFile(path);
    if (contents.includes(0)) continue;
    const text = contents.toString("utf8");
    for (const line of fragments) {
      assert(!text.includes(line) && !text.includes(JSON.stringify(line).slice(1, -1)), `private scenario text found in ${path}`);
    }
    assert(!privateText.test(text), `project-specific story text found in ${path}`);
  }

  execFileSync("npm", ["install", "--prefix", extraction, "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
    cwd: root,
    env: { ...process.env, npm_config_cache: join(temporary, "npm-cache") },
    stdio: "inherit",
  });
  const smoke = `
    const root = await import('asternihva-adv-engine');
    const core = await import('asternihva-adv-engine/core');
    const web = await import('asternihva-adv-engine/web');
    const live2d = await import('asternihva-adv-engine/live2d');
    const tooling = await import('asternihva-adv-engine/tooling');
    if (!root.AdvEngine || !core.AdvEngine || !core.ScenarioCatalog) throw new Error('core exports missing');
    if (!web.DomUi || !web.SpriteRenderer) throw new Error('web exports missing');
    if (!live2d.Live2DRenderer) throw new Error('Live2D export missing');
    if (!tooling.validateScenarios) throw new Error('tooling export missing');
    if (tooling.lintScenarioSource) {
      try {
        const parsed = await tooling.lintScenarioSource('export const game = { scenes: {} };');
        if (!parsed.valid) throw new Error('installed source lint failed');
      } catch (error) {
        if (error.code !== 'SCENARIO_SOURCE_PARSER_MISSING') throw error;
        // Optional parser absence must not block importing any package entry point.
      }
    }
    try { await import('asternihva-adv-engine/dist/engine.js'); throw new Error('deep import unexpectedly allowed'); } catch (error) { if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error; }
    if ('window' in globalThis || 'document' in globalThis) throw new Error('unexpected browser global in Node');
  `;
  execFileSync(process.execPath, ["--input-type=module", "-e", smoke], {
    cwd: extraction,
    stdio: "inherit",
  });

  if (names.includes("scripts/cli.mjs")) {
    const fixturePath = join(extraction, "sample.mjs");
    await writeFile(fixturePath, `export default { scenario: { id: "sample", title: "Sample" }, start: "scene-a", characters: [], scenes: { "scene-a": [{ type: "line", text: "hello" }, { type: "end" }] } };`);
    const cli = join(extraction, "node_modules/asternihva-adv-engine/scripts/cli.mjs");
    const result = JSON.parse(execFileSync(process.execPath, [cli, "scenario", "validate", fixturePath], { cwd: extraction, encoding: "utf8" }));
    assert.equal(result.valid, true, "installed CLI validation failed");
    assert.equal(JSON.parse(execFileSync(process.execPath, [cli, "scenario", "stats", fixturePath], { cwd: extraction, encoding: "utf8" }))[0].lines, 1);
  }

  // Compile a consumer with ES-only libs; declaration dependencies must not require DOM.
  await writeFile(join(extraction, "tsconfig.json"), JSON.stringify({compilerOptions:{noEmit:true,strict:true,lib:["ES2022"],target:"ES2022",module:"NodeNext",moduleResolution:"NodeNext",types:[]},files:["core-smoke.mts"]}));
  await writeFile(join(extraction, "core-smoke.mts"), `
    import { AdvEngine, CharacterStage, ScenarioCatalog } from "asternihva-adv-engine/core";
    const stage = new CharacterStage({}, [], []);
    const catalog = new ScenarioCatalog([]);
    void [AdvEngine, stage, catalog];
  `);
  execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"),
    "-p", "tsconfig.json"], {
    cwd: extraction, stdio: "inherit",
  });
  console.log(`Pack smoke passed: ${names.length} package files; ${packed.size} compressed bytes; all five imports resolved.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
