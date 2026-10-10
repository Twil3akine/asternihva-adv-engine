import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const revision = "bd8f81ddb5c74d5c8897b36ad88b440266245103";
const files = {
  "ZenKakuGothicNew-Regular.ttf": ["ofl/zenkakugothicnew/ZenKakuGothicNew-Regular.ttf", "b840cd07a67d89cacca44249ae49aa99ee7640eb5ce623be8d8983d6aabac801"],
  "ZenKakuGothicNew-Medium.ttf": ["ofl/zenkakugothicnew/ZenKakuGothicNew-Medium.ttf", "651a3f7280b7f36262601ee76d8388a8dc4372dcc67aff025a608939a562b525"],
  "Ubuntu-Regular.ttf": ["ufl/ubuntu/Ubuntu-Regular.ttf", "3128df86a31805618436d0ae5651ba4285d0c9de0a39057d025f64ee33bceb64"],
  "Ubuntu-Medium.ttf": ["ufl/ubuntu/Ubuntu-Medium.ttf", "3cd952b8b52581e48a8fa95b31c8829c2baa41b635042a69587d57f98092961e"],
  "OFL-ZenKakuGothicNew.txt": ["ofl/zenkakugothicnew/OFL.txt", "0fac78a235c98d640cb06332eb5362c211d86fa03c011df438c35005d22ad2c7"],
  "UFL-Ubuntu.txt": ["ufl/ubuntu/UFL.txt", "2f0015108d68627bd788d313f529c21ff4da2c2c42a5e1f3883acc83480f9002"],
};

const output = resolve(root, "public/fonts");
await mkdir(output, { recursive: true });
for (const [name, [path, expected]] of Object.entries(files)) {
  const response = await fetch(`https://raw.githubusercontent.com/google/fonts/${revision}/${path}`);
  if (!response.ok) throw new Error(`Could not download ${path}: HTTP ${response.status}`);
  const content = Buffer.from(await response.arrayBuffer());
  const actual = createHash("sha256").update(content).digest("hex");
  if (actual !== expected) throw new Error(`SHA-256 mismatch for ${path}`);
  await writeFile(resolve(output, name), content);
  console.log(`${name}: ${content.byteLength} bytes`);
}
