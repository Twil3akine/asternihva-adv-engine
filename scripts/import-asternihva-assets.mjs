import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assetManifest } from '../examples/asternihva/asset-manifest.mjs';

const defaultSourceDir = '/Users/rutt/mein/Asternihva Project/Image/Standings/emotion';
const defaultDestinationDir = fileURLToPath(
  new URL('../examples/asternihva/public/characters/', import.meta.url),
);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function resolvePathThroughExistingParent(directory) {
  const absolutePath = path.resolve(directory);
  try {
    return await realpath(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const parentPath = path.dirname(absolutePath);
    if (parentPath === absolutePath) return absolutePath;
    return path.join(await resolvePathThroughExistingParent(parentPath), path.basename(absolutePath));
  }
}

async function assertDestinationOutsideSource(sourceDir, destinationDir) {
  const [resolvedSource, resolvedDestination] = await Promise.all([
    realpath(sourceDir),
    resolvePathThroughExistingParent(destinationDir),
  ]);
  const relativePath = path.relative(resolvedSource, resolvedDestination);
  const isInsideSource =
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath));
  if (isInsideSource) {
    throw new Error(`Destination must be outside source directory: ${destinationDir}`);
  }
}

async function replaceFileAtomically(destinationPath, bytes) {
  const temporaryPath = `${destinationPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, bytes, { flag: 'wx' });
    await rename(temporaryPath, destinationPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

export async function importAssets(sourceDir, destinationDir, { replaceExisting = false } = {}) {
  await assertDestinationOutsideSource(sourceDir, destinationDir);
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
        if (!replaceExisting) {
          throw new Error(`Refusing to overwrite different asset: ${asset.destinationPath}`);
        }
        asset.replaceExisting = true;
        continue;
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
    if (asset.replaceExisting) {
      await replaceFileAtomically(asset.destinationPath, asset.bytes);
      continue;
    }
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
  const args = process.argv.slice(2);
  const replaceExisting = args.includes('--replace-existing');
  const positionalArgs = args.filter((argument) => argument !== '--replace-existing');
  try {
    const hasUnknownOption = args.some(
      (argument) => argument.startsWith('--') && argument !== '--replace-existing',
    );
    if (positionalArgs.length > 1 || hasUnknownOption) {
      throw new Error('Usage: node scripts/import-asternihva-assets.mjs [--replace-existing] [sourceDir]');
    }
    const sourceDir = positionalArgs[0] ?? defaultSourceDir;
    const sentinel = await importAssets(sourceDir, defaultDestinationDir, { replaceExisting });
    const count = Object.values(sentinel.characters).reduce((total, entries) => total + Object.keys(entries).length, 0);
    console.log(`Imported ${count} Asternihva character assets into ${defaultDestinationDir}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
