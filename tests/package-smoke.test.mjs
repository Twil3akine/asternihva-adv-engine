import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

test("npm package contents and installed public imports are smoke tested", () => {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  execFileSync(process.execPath, ["scripts/package-smoke.mjs"], { cwd: root, stdio: "inherit" });
});
