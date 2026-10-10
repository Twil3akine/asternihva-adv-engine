import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [theme, main, coreCss, importer] = await Promise.all([
  readFile(new URL("../examples/asternihva/theme.css", import.meta.url), "utf8"),
  readFile(new URL("../examples/asternihva/main.mjs", import.meta.url), "utf8"),
  readFile(new URL("../src/ui/dom-ui.ts", import.meta.url), "utf8"),
  readFile(new URL("../examples/asternihva/import-fonts.mjs", import.meta.url), "utf8"),
]);

test("Asternihva loads licensed local Japanese and Latin font faces before play", () => {
  assert.match(theme, /font-family:\s*"Zen Kaku Gothic New"/);
  assert.match(theme, /font-family:\s*Ubuntu/);
  assert.match(theme, /ZenKakuGothicNew-Regular\.ttf/);
  assert.match(theme, /ZenKakuGothicNew-Medium\.ttf/);
  assert.match(theme, /Ubuntu-Regular\.ttf/);
  assert.match(theme, /Ubuntu-Medium\.ttf/);
  assert.match(main, /document\.fonts\.load\('400 16px "Zen Kaku Gothic New"'/);
  assert.match(main, /document\.fonts\.load\('400 16px Ubuntu'/);
  assert.match(importer, /bd8f81ddb5c74d5c8897b36ad88b440266245103/);
  assert.doesNotMatch(coreCss, /Zen Kaku Gothic New|Ubuntu/);
});
