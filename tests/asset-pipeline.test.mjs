import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,stat,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import sharp from 'sharp';
import {buildAssets,validateAssetManifest} from '../dist/tooling/index.js';
import {execFileSync} from 'node:child_process';
const transformer={version:'fixture-v1',transform:async(input,o)=>sharp(input).resize({width:o.maxWidth,height:o.maxHeight,fit:'inside',withoutEnlargement:true}).toFormat(o.format).toBuffer()};
async function fixture(t,format='webp'){const dir=await mkdtemp(join(tmpdir(),'adv-assets-'));t.after(async()=>{const {rm}=await import('node:fs/promises');await rm(dir,{recursive:true,force:true});});const source=await sharp({create:{width:12,height:8,channels:4,background:{r:20,g:40,b:60,alpha:.5}}}).png().toBuffer();await writeFile(join(dir,'input.png'),source);return {dir,options:{baseDir:dir,outDir:join(dir,'out'),transformer,manifest:{version:1,assets:[{id:'alice',source:'input.png',format,maxWidth:6,maxHeight:6,thumbnail:{size:4}}]}}};}
for(const format of ['png','webp'])test(`asset build preserves alpha and bounds for ${format} including thumbnail`,async t=>{
 const {options}=await fixture(t,format),r=await buildAssets(options);assert.deepEqual(r.built,['alice']);const a=r.manifest.assets[0],image=await sharp(join(options.outDir,a.file)).metadata(),thumb=await sharp(join(options.outDir,a.thumbnail.file)).metadata();assert.equal(image.width,6);assert.equal(image.height,4);assert.equal(image.hasAlpha,true);assert.ok(thumb.width<=4&&thumb.height<=4);assert.equal(thumb.hasAlpha,true);assert.match(a.hash,/^[a-f0-9]{64}$/);assert.ok(a.file.includes(a.hash.slice(0,16)));
});
test('unchanged assets skip transforms and preserve generated manifest modification time',async t=>{
 const {options}=await fixture(t);await buildAssets(options);const before=await stat(join(options.outDir,'assets.generated.json'));const r=await buildAssets({...options,transformer:{version:'fixture-v1',transform(){throw Error('must skip');}}});assert.deepEqual(r.skipped,['alice']);assert.equal((await stat(join(options.outDir,'assets.generated.json'))).mtimeMs,before.mtimeMs);
});
test('changed source or settings rebuild and report stale generated files without deleting',async t=>{
 const {options}=await fixture(t);const first=await buildAssets(options);const file=first.manifest.assets[0].file;options.manifest.assets[0].maxWidth=3;const r=await buildAssets(options);assert.deepEqual(r.built,['alice']);assert.ok(r.stale.includes(file));assert.ok(await readFile(join(options.outDir,file)));await writeFile(join(options.baseDir,'input.png'),await sharp({create:{width:10,height:10,channels:4,background:'red'}}).png().toBuffer());assert.deepEqual((await buildAssets(options)).built,['alice']);
});
test('missing/corrupt output is rebuilt instead of incorrectly skipped',async t=>{
 const {options}=await fixture(t);const r=await buildAssets(options);await writeFile(join(options.outDir,r.manifest.assets[0].file),'broken');assert.deepEqual((await buildAssets(options)).built,['alice']);
});
test('removed assets are stale and unrelated files remain untouched',async t=>{
 const {options}=await fixture(t);const first=await buildAssets(options);await writeFile(join(options.outDir,'user.txt'),'hello');options.manifest.assets=[];const r=await buildAssets(options);assert.ok(r.stale.includes(first.manifest.assets[0].file));assert.equal(r.stale.includes('user.txt'),false);assert.equal(await readFile(join(options.outDir,'user.txt'),'utf8'),'hello');
});
test('manifest rejects unsafe IDs, duplicate IDs, formats and invalid dimensions',()=>{
 const a={id:'alice',source:'input.png',format:'png'};for(const manifest of [{version:2,assets:[a]},{version:1,assets:[a,a]},...['../alice','alice/bob',''].map(id=>({version:1,assets:[{...a,id}]})),{version:1,assets:[{...a,format:'avif'}]},{version:1,assets:[{...a,maxWidth:0}]},{version:1,assets:[{...a,thumbnail:{size:-1}}]}])assert.throws(()=>validateAssetManifest(manifest),TypeError);
});
test('missing source and bad conversion fail without replacing the previous manifest',async t=>{
 const {options}=await fixture(t);await buildAssets(options);const path=join(options.outDir,'assets.generated.json'),before=await readFile(path,'utf8');options.manifest.assets[0].source='missing.png';await assert.rejects(buildAssets(options),e=>e.code==='ENOENT');assert.equal(await readFile(path,'utf8'),before);
});
test('generated output symlinks are rejected',async t=>{
 const {options,dir}=await fixture(t);await buildAssets(options);const {unlink}=await import('node:fs/promises');const p=join(options.outDir,'assets.generated.json');await unlink(p);await writeFile(join(dir,'target'),'hello');await symlink(join(dir,'target'),p);await assert.rejects(buildAssets(options),/symbolic link|Unexpected token/);assert.equal(await readFile(join(dir,'target'),'utf8'),'hello');
});
test('CLI builds assets and a second run skips with programmatic fixture images',async t=>{
 const {options,dir}=await fixture(t);const path=join(dir,'assets.json');await writeFile(path,JSON.stringify(options.manifest));const run=()=>JSON.parse(execFileSync(process.execPath,['scripts/cli.mjs','asset','build',path,options.outDir],{encoding:'utf8'}));assert.deepEqual(run().built,['alice']);assert.deepEqual(run().skipped,['alice']);
});
