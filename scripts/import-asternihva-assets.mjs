import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assetManifest } from '../examples/asternihva/asset-manifest.mjs';

const defaultSourceDir = '/Users/rutt/mein/Asternihva Project/Image/standings/emotion';
const defaultDestinationDir = fileURLToPath(
  new URL('../examples/asternihva/public/characters/', import.meta.url),
);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function importAssets(sourceDir, destinationDir) {
  const assets = [];

  // Read and validate the complete source set before creating or changing destinations.
  for (const character of assetManifest) {
    for (const [expression, filename] of Object.entries(character.expressions)) {
      const sourcePath = path.join(sourceDir, filename);
      let bytes;
      try {
        bytes = await readFile(sourcePath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new Error(`Missing source asset: ${sourcePath}`, { cause: error });
        }
        throw error;
      }

      const relativePath = path.join(character.id, filename);
      const destinationPath = path.join(destinationDir, relativePath);
      assets.push({ character, expression, filename, relativePath, destinationPath, bytes, digest: sha256(bytes) });
    }
  }

  // Check every existing destination before writing any new asset.
  for (const asset of assets) {
    try {
      const existing = await readFile(asset.destinationPath);
      if (sha256(existing) !== asset.digest) {
        throw new Error(`Refusing to overwrite different asset: ${asset.destinationPath}`);
      }
      asset.alreadyPresent = true;
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
  }

  for (const asset of assets) {
    if (asset.alreadyPresent) continue;
    await mkdir(path.dirname(asset.destinationPath), { recursive: true });
    await writeFile(asset.destinationPath, asset.bytes, { flag: 'wx' });
  }

  const characters = {};
  for (const character of assetManifest) {
    characters[character.id] = Object.fromEntries(
      Object.entries(character.expressions).map(([expression, filename]) => [
        expression,
        `${character.id}/${filename}`,
      ]),
    );
  }
  const sentinel = { version: 1, characters };
  const sentinelPath = path.join(destinationDir, '.local-assets.json');
  await mkdir(destinationDir, { recursive: true });
  const temporarySentinelPath = `${sentinelPath}.${process.pid}.tmp`;
  try {
    await writeFile(temporarySentinelPath, `${JSON.stringify(sentinel, null, 2)}\n`, { flag: 'wx' });
    await rename(temporarySentinelPath, sentinelPath);
  } catch (error) {
    // A stale temp file from an earlier interrupted run should not block a retry.
    if (error.code === 'EEXIST') {
      const suffix = `${Date.now()}`;
      const retryPath = `${sentinelPath}.${process.pid}.${suffix}.tmp`;
      await writeFile(retryPath, `${JSON.stringify(sentinel, null, 2)}\n`, { flag: 'wx' });
      await rename(retryPath, sentinelPath);
    } else {
      throw error;
    }
  }

  return sentinel;
}

async function isMain() {
  if (!process.argv[1]) return false;
  try {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (await isMain()) {
  const sourceDir = process.argv[2] ?? defaultSourceDir;
  try {
    const sentinel = await importAssets(sourceDir, defaultDestinationDir);
    const count = Object.values(sentinel.characters).reduce((total, entries) => total + Object.keys(entries).length, 0);
    console.log(`Imported ${count} Asternihva character assets into ${defaultDestinationDir}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
