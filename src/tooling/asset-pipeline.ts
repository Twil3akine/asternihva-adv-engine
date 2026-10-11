import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile, lstat } from "node:fs/promises";
import { resolve, join } from "node:path";
export type AssetFormat = "png" | "webp";
export interface ImageTransform { format: AssetFormat; maxWidth?: number; maxHeight?: number; }
export interface AssetSource extends ImageTransform { id: string; source: string; thumbnail?: { size: number; format?: AssetFormat }; }
export interface AssetManifest { version: 1; assets: AssetSource[]; }
export interface ImageTransformer { readonly version: string; transform(input: Uint8Array, options: ImageTransform): Promise<Uint8Array>; }
export interface GeneratedAsset { id: string; file: string; hash: string; inputHash: string; thumbnail?: { file: string; hash: string }; }
export interface GeneratedAssetManifest { version: 1; assets: GeneratedAsset[]; }
export interface AssetBuildResult { manifest: GeneratedAssetManifest; built: string[]; skipped: string[]; stale: string[]; }
export interface AssetBuildOptions { manifest: AssetManifest; baseDir: string; outDir: string; transformer: ImageTransformer; }
const generatedName = /^[A-Za-z0-9_-]+\.[a-f0-9]{16}\.(png|webp)$/;
const hash = (data: Uint8Array | string): string => createHash("sha256").update(data).digest("hex");
const positive = (value: unknown): boolean => value === undefined || (Number.isSafeInteger(value) && (value as number) > 0);
const format = (value: unknown): boolean => value === "png" || value === "webp";
export function validateAssetManifest(value: unknown): asserts value is AssetManifest {
  const m = value as AssetManifest | null;
  if (!m || m.version !== 1 || !Array.isArray(m.assets) || m.assets.some(a => !a || typeof a.id !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(a.id) || typeof a.source !== "string" || !a.source.trim() || !format(a.format) ||
    !positive(a.maxWidth) || !positive(a.maxHeight) || (a.thumbnail !== undefined &&
      (!a.thumbnail || !Number.isSafeInteger(a.thumbnail.size) || a.thumbnail.size <= 0 || (a.thumbnail.format !== undefined && !format(a.thumbnail.format))))) ||
    new Set(m.assets.map(a => a.id)).size !== m.assets.length) throw new TypeError("Invalid asset manifest.");
}
async function readPrevious(path: string): Promise<GeneratedAssetManifest> {
  try {
    const m = JSON.parse(await readFile(path, "utf8")) as GeneratedAssetManifest;
    if (!m || m.version !== 1 || !Array.isArray(m.assets) || m.assets.some(a => !a || typeof a.id !== "string" || !generatedName.test(a.file) ||
      typeof a.hash !== "string" || typeof a.inputHash !== "string" || (a.thumbnail && (!generatedName.test(a.thumbnail.file) || typeof a.thumbnail.hash !== "string")))) return { version: 1, assets: [] };
    return m;
  } catch (error) { if ((error as { code?: string }).code === "ENOENT" || error instanceof SyntaxError) return { version: 1, assets: [] }; throw error; }
}
async function validFile(outDir: string, name: string, digest: string): Promise<boolean> {
  try { if ((await lstat(join(outDir, name))).isSymbolicLink()) throw new Error("Generated output cannot be a symbolic link."); return hash(await readFile(join(outDir, name))) === digest; }
  catch (error) { if ((error as { code?: string }).code === "ENOENT") return false; throw error; }
}
async function atomicWrite(path: string, data: Uint8Array | string): Promise<void> {
  try { if ((await lstat(path)).isSymbolicLink()) throw new Error("Generated output cannot be a symbolic link."); }
  catch (error) { if ((error as { code?: string }).code !== "ENOENT") throw error; }
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, data); await rename(temporary, path);
}
/** Converts generic manifest assets; stale generated files are reported, never deleted. */
export async function buildAssets(options: AssetBuildOptions): Promise<AssetBuildResult> {
  validateAssetManifest(options.manifest);
  const outDir = resolve(options.outDir);
  await mkdir(outDir, { recursive: true });
  const manifestPath = join(outDir, "assets.generated.json");
  const previous = await readPrevious(manifestPath);
  const result: AssetBuildResult = { manifest: { version: 1, assets: [] }, built: [], skipped: [], stale: [] };
  for (const asset of options.manifest.assets) {
    const bytes = await readFile(resolve(options.baseDir, asset.source));
    const transform: ImageTransform = { format: asset.format, maxWidth: asset.maxWidth, maxHeight: asset.maxHeight };
    const thumbnail = asset.thumbnail ? { size: asset.thumbnail.size, format: asset.thumbnail.format ?? asset.format } : undefined;
    const inputHash = hash(Buffer.concat([bytes, Buffer.from(JSON.stringify({ version: options.transformer.version, transform, thumbnail }))]));
    const old = previous.assets.find(a => a.id === asset.id && a.inputHash === inputHash);
    if (old && await validFile(outDir, old.file, old.hash) && (!old.thumbnail || await validFile(outDir, old.thumbnail.file, old.thumbnail.hash))) {
      result.manifest.assets.push(old); result.skipped.push(asset.id); continue;
    }
    const output = await options.transformer.transform(bytes, transform);
    const digest = hash(output), file = `${asset.id}.${digest.slice(0, 16)}.${asset.format}`;
    const generated: GeneratedAsset = { id: asset.id, file, hash: digest, inputHash };
    await atomicWrite(join(outDir, file), output);
    if (thumbnail) {
      const data = await options.transformer.transform(bytes, { format: thumbnail.format, maxWidth: thumbnail.size, maxHeight: thumbnail.size });
      const thumbnailHash = hash(data), thumbnailFile = `${asset.id}-thumb.${thumbnailHash.slice(0, 16)}.${thumbnail.format}`;
      await atomicWrite(join(outDir, thumbnailFile), data);
      generated.thumbnail = { file: thumbnailFile, hash: thumbnailHash };
    }
    result.manifest.assets.push(generated); result.built.push(asset.id);
  }
  const active = new Set(result.manifest.assets.flatMap(a => [a.file, ...(a.thumbnail ? [a.thumbnail.file] : [])]));
  result.stale = (await readdir(outDir)).filter(name => generatedName.test(name) && !active.has(name)).sort();
  const json = JSON.stringify(result.manifest, null, 2) + "\n";
  let previousText: string | undefined;
  try { previousText = await readFile(manifestPath, "utf8"); } catch (error) { if ((error as {code?: string}).code !== "ENOENT") throw error; }
  if (previousText !== json) await atomicWrite(manifestPath, json);
  return result;
}
