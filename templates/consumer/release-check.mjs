import { lstat, readdir, readFile } from 'node:fs/promises';
import { resolve, relative, extname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Local-only production output guard. It never deploys or deletes files. */
export async function checkRelease(directory, { maxBytes = 25 * 1024 * 1024, maxFiles = 20000 } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || !Number.isSafeInteger(maxFiles) || maxFiles <= 0) throw new TypeError('Limits must be positive integers.');
  const root = resolve(directory), errors = [], files = [];
  const allowed = new Set(['.html','.js','.css','.json','.svg','.png','.webp','.avif','.jpg','.jpeg','.ico','.mp3','.ogg','.wav','.m4a','.aac','.flac','.woff','.woff2','.ttf','.txt','.webmanifest']);
  async function visit(path) {
    const stat = await lstat(path), name = relative(root, path) || '.';
    if (stat.isSymbolicLink()) { errors.push(`${name}: symlink`); return; }
    if (stat.isDirectory()) {
      if (path !== root && basename(path).startsWith('.')) { errors.push(`${name}: hidden directory`); return; }
      for (const entry of (await readdir(path)).sort()) await visit(resolve(path, entry));
      return;
    }
    if (!stat.isFile()) { errors.push(`${name}: non-regular file`); return; }
    files.push(name);
    if (stat.size > maxBytes) errors.push(`${name}: asset exceeds size limit`);
    const special = ['_headers','_redirects'].includes(basename(path));
    if (basename(path).startsWith('.') || (!special && !allowed.has(extname(path).toLowerCase()))) errors.push(`${name}: unexpected source/output file`);
    if (['.js','.css','.html'].includes(extname(path).toLowerCase())) {
      const text = await readFile(path, 'utf8');
      if (/sourceMappingURL\s*=/.test(text)) errors.push(`${name}: source map reference`);
    }
  }
  await visit(root);
  if (!files.includes('index.html')) errors.push('index.html: missing');
  if (files.length > maxFiles) errors.push('asset file count exceeds limit');
  return { valid: errors.length === 0, files: files.length, errors };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await checkRelease(process.argv[2] ?? 'dist');
  console.log(JSON.stringify(result));
  if (!result.valid) process.exitCode = 1;
}
