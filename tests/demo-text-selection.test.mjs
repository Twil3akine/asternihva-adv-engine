import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("game UI disables text selection while LOG remains copyable", async () => {
  const css = await readFile(new URL("../examples/asternihva/theme.css", import.meta.url), "utf8");
  assert.match(css, /\.game,\s*\.game \*\s*\{[^}]*user-select:\s*none;[^}]*-webkit-user-select:\s*none/);
  assert.match(css, /\.game \.adv-log-content,\s*\.game \.adv-log-content \*\s*\{[^}]*user-select:\s*text;[^}]*-webkit-user-select:\s*text/);
});
