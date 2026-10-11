import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import ts from "typescript";
const seen = new Set();
const forbidden = /^(window|document|HTMLElement|HTML\w+Element|Storage|KeyboardEvent|MouseEvent|AudioContext|AudioBuffer|Node|Element|Animation|PlaybackDirection)$/;
async function visit(path) {
  if (seen.has(path)) return;
  seen.add(path);
  const source = ts.createSourceFile(path, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true);
  const imports = [];
  function inspect(node) {
    if (ts.isIdentifier(node)) assert(!forbidden.test(node.text), `DOM identifier in core dependency: ${path}`);
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      assert(specifier.startsWith("."), `External import in core dependency: ${path}`);
      const target = resolve(dirname(path), specifier.replace(/\.js$/, ".ts"));
      assert(!/\/(ui|renderers|adapters|assets)\//.test(target), `Browser implementation imported by core: ${path}`);
      imports.push(target);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
  for (const target of imports) await visit(target);
}
await visit(resolve("src/core.ts"));
console.log(`Core boundary passed: ${seen.size} source modules; no DOM imports/types.`);
