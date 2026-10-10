import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Asternihva choices have a stronger centered footprint and reserve the yellow accent for focus", async () => {
  const css = await readFile(new URL("../examples/asternihva/theme.css", import.meta.url), "utf8");
  assert.match(css, /--adv-choice-width:\s*50%/);
  assert.match(css, /--adv-choice-row-size:\s*4\.8cqw/);
  assert.match(css, /\.game \.adv-choice::before\s*\{\s*color:\s*var\(--adv-muted-color\)/);
  assert.match(css, /\.game \.adv-choice:hover::before,\s*\.game \.adv-choice:focus-visible::before\s*\{\s*color:\s*var\(--adv-accent\)/);
  assert.match(css, /data-mode="choice"\]\:\:after\s*\{[^}]*opacity:\s*\.12/);
});
