import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Asternihva menu and settings actions use Japanese player-facing labels", async () => {
  const html = await readFile(new URL("../examples/asternihva/index.html", import.meta.url), "utf8");
  const settings = await readFile(new URL("../examples/asternihva/demo-settings.mjs", import.meta.url), "utf8");
  for (const label of ["ゲームに戻る", "ログ", "設定", "最初から", "AUTO速度", "キャラクター演出", "画面演出", "全画面表示"]) {
    assert.ok(html.includes(label), `Missing menu label: ${label}`);
  }
  assert.doesNotMatch(html, />\s*(Resume|Restart|Settings|Enter Fullscreen|Exit Fullscreen)\s*</);
  assert.match(settings, /全画面表示を終了/);
  assert.match(settings, /全画面表示を利用できません/);
});
