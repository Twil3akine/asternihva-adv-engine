import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { assetManifest } from '../examples/asternihva/asset-manifest.mjs';
import { importAssets } from '../scripts/import-asternihva-assets.mjs';

async function makeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'asternihva-assets-'));
  const sourceDir = path.join(root, 'source');
  const destinationDir = path.join(root, 'public', 'characters');
  await mkdir(sourceDir, { recursive: true });

  const sourceBytes = new Map();
  let index = 0;
  for (const character of assetManifest) {
    for (const filename of Object.values(character.expressions)) {
      const bytes = Buffer.from(`fixture image bytes ${index++}: ${filename}`);
      sourceBytes.set(filename, bytes);
      await writeFile(path.join(sourceDir, filename), bytes);
    }
  }
  return { root, sourceDir, destinationDir, sourceBytes };
}

test('manifest explicitly aliases neutral source images to normal expression IDs', () => {
  assert.deepEqual(assetManifest.map(({ id }) => id), ['noah', 'seren', 'luminal']);
  for (const character of assetManifest) {
    assert.equal(character.defaultExpression, 'normal');
    assert.equal(character.expressions.normal, `${character.name}_neutral.png`);
    assert.ok(Number.isFinite(character.portrait.scale) && character.portrait.scale > 0);
    assert.ok(Number.isFinite(character.portrait.anchorX) && Number.isFinite(character.portrait.anchorY));
  }
  assert.equal(assetManifest[1].expressions.embarrased, 'Seren_embarrased.png');
  assert.equal(assetManifest[0].expressions.relaxed, 'Noah_relaxed.png');
  assert.equal(assetManifest[1].expressions.relax, 'Seren_relax.png');
  assert.equal(assetManifest[2].expressions.relax, 'Luminal_relax.png');
});

test('imports all 30 files byte-for-byte, preserves sources, and writes the ready manifest', async (t) => {
  const fixture = await makeFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));

  const manifest = await importAssets(fixture.sourceDir, fixture.destinationDir);
  assert.equal(Object.values(manifest.characters).reduce((count, entries) => count + Object.keys(entries).length, 0), 30);

  for (const character of assetManifest) {
    for (const [expression, filename] of Object.entries(character.expressions)) {
      const relativePath = path.join(character.id, filename);
      assert.equal(manifest.characters[character.id][expression], relativePath);
      assert.deepEqual(
        await readFile(path.join(fixture.destinationDir, relativePath)),
        fixture.sourceBytes.get(filename),
      );
      assert.deepEqual(await readFile(path.join(fixture.sourceDir, filename)), fixture.sourceBytes.get(filename));
    }
  }

  assert.deepEqual(
    JSON.parse(await readFile(path.join(fixture.destinationDir, '.local-assets.json'), 'utf8')),
    manifest,
  );
});

test('missing source is rejected before any destination files are written', async (t) => {
  const fixture = await makeFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await rm(path.join(fixture.sourceDir, 'Luminal_troubled.png'));

  await assert.rejects(
    importAssets(fixture.sourceDir, fixture.destinationDir),
    /Missing source asset:.*Luminal_troubled\.png/,
  );
  await assert.rejects(readdir(fixture.destinationDir), { code: 'ENOENT' });
});

test('different existing destination is refused before any other asset is written', async (t) => {
  const fixture = await makeFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const conflictingPath = path.join(fixture.destinationDir, 'luminal', 'Luminal_troubled.png');
  await mkdir(path.dirname(conflictingPath), { recursive: true });
  await writeFile(conflictingPath, 'pre-existing different bytes');

  await assert.rejects(
    importAssets(fixture.sourceDir, fixture.destinationDir),
    /Refusing to overwrite different asset:.*Luminal_troubled\.png/,
  );
  await assert.rejects(readFile(path.join(fixture.destinationDir, 'noah', 'Noah_angry.png')), { code: 'ENOENT' });
  assert.equal(await readFile(conflictingPath, 'utf8'), 'pre-existing different bytes');
  await assert.rejects(readFile(path.join(fixture.destinationDir, '.local-assets.json')), { code: 'ENOENT' });
});

test('explicit replacement updates changed destination bytes and preserves source bytes', async (t) => {
  const fixture = await makeFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await importAssets(fixture.sourceDir, fixture.destinationDir);

  const filename = 'Noah_angry.png';
  const relativePath = path.join('noah', filename);
  const sourcePath = path.join(fixture.sourceDir, filename);
  const destinationPath = path.join(fixture.destinationDir, relativePath);
  const previousDestinationBytes = await readFile(destinationPath);
  const refreshedBytes = Buffer.from('refreshed source image bytes');
  await writeFile(sourcePath, refreshedBytes);

  await importAssets(fixture.sourceDir, fixture.destinationDir, { replaceExisting: true });

  assert.notDeepEqual(await readFile(destinationPath), previousDestinationBytes);
  assert.deepEqual(await readFile(destinationPath), refreshedBytes);
  assert.deepEqual(await readFile(sourcePath), refreshedBytes);
  assert.deepEqual(await readFile(path.join(fixture.destinationDir, 'noah', 'Noah_happy.png')), fixture.sourceBytes.get('Noah_happy.png'));
  assert.ok((await readdir(path.dirname(destinationPath))).every((filename) => !filename.endsWith('.tmp')));
});

test('destination equal to or inside source directory is rejected', async (t) => {
  const fixture = await makeFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));

  await assert.rejects(
    importAssets(fixture.sourceDir, fixture.sourceDir),
    /Destination must be outside source directory/,
  );
  await assert.rejects(
    importAssets(fixture.sourceDir, path.join(fixture.sourceDir, 'generated')),
    /Destination must be outside source directory/,
  );
  assert.deepEqual((await readdir(fixture.sourceDir)).sort(), [...fixture.sourceBytes.keys()].sort());
});
