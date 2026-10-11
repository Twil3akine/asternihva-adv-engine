import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true}); await mkdir('dist');
await build({entryPoints:['src/main.ts'],bundle:true,format:'esm',target:'es2022',outfile:'dist/main.js',sourcemap:false});
await cp('public','dist',{recursive:true}); await cp('index.html','dist/index.html');
