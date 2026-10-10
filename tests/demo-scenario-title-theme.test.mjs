import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("persistent scenario title is a readable two-line block and hides behind the episode card", async () => {
  const css = await readFile(new URL("../examples/asternihva/theme.css", import.meta.url), "utf8");
  assert.match(css, /\.game \.adv-scenario-title\s*\{[^}]*width:\s*28cqw/);
  assert.match(css, /font:\s*500 1\.65cqw\/1\.45/);
  assert.match(css, /data-has-chapter="true"\]::first-line[^}]*\.8cqw/);
  assert.match(css, /data-mode="intro"\] \.adv-scenario-title\s*\{\s*visibility:\s*hidden/);
});
