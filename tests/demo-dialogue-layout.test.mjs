import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Asternihva dialogue stays centered at the requested narrower width without enabling scrolling", async () => {
  const css = await readFile(new URL("../examples/asternihva/theme.css", import.meta.url), "utf8");
  const core = await readFile(new URL("../src/ui/dom-ui.ts", import.meta.url), "utf8");
  assert.match(css, /--adv-dialog-width:\s*74%/);
  assert.match(core, /left:\s*50%;\s*width:\s*var\(--adv-dialog-width\);\s*bottom:/);
  assert.match(core, /\.adv-text\s*\{[^}]*overflow:\s*hidden/);
  assert.doesNotMatch(core, /\.adv-text\s*\{[^}]*overflow-y:\s*auto/);
});
