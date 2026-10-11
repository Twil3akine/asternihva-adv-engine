import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const fingerprints = JSON.parse(await readFile(new URL('./boundary-fingerprints.json', import.meta.url), 'utf8'));
const hash = text => createHash('sha256').update(text).digest('hex');
/** Fingerprints detect reserved work details without reproducing them in public code. */
export function scanPublicText(text, rules = fingerprints) {
  const chars = [...text.toLowerCase()];
  const byLength = new Map();
  for (const rule of rules) {
    if (!byLength.has(rule.length)) byLength.set(rule.length, new Set());
    byLength.get(rule.length).add(rule.sha256);
  }
  for (const [length, hashes] of byLength) {
    for (let i = 0; i + length <= chars.length; i++) {
      if (hashes.has(hash(chars.slice(i, i + length).join('')))) return 'reserved-work-detail';
    }
  }
  if (/(?:\/|[A-Z]:\\)(?:Users|Volumes|workspace)[\/\\]/i.test(text)) return 'private-filesystem-path';
  const project = 'asternihva-adv-engine'.replace('-adv-engine', '');
  if (text.includes(`examples/${project}/`) || text.includes(`import-${project}-assets`) || /local-scenarios\.mjs/.test(text)) return 'project-only-import';
}
export async function checkBoundary(files, { fragments = [] } = {}) {
  let count = 0;
  for (const path of files) {
    let bytes;
    try { bytes = await readFile(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const name = relative(root, path);
    const failure = scanPublicText(name) || (!bytes.includes(0) && scanPublicText(bytes.toString('utf8')));
    if (failure) throw Error(`Public boundary failed (${failure}): ${name}`);
    if (!bytes.includes(0)) for (const fragment of fragments) {
      if (bytes.toString('utf8').includes(fragment) || bytes.toString('utf8').includes(JSON.stringify(fragment).slice(1,-1))) throw Error(`Private text fingerprint found: ${name}`);
    }
    count++;
  }
  return count;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).map(p => resolve(root,p));
  console.log(`Public boundary passed: ${await checkBoundary(paths)} tracked files.`);
}
