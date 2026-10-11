import {rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
// dist is generated and ignored. Clearing it prevents stale branch output entering a tarball.
await rm(new URL('../dist',import.meta.url),{recursive:true,force:true});
execFileSync(process.execPath,[fileURLToPath(new URL('../node_modules/typescript/bin/tsc',import.meta.url)),'-p','tsconfig.json'],{cwd:root,stdio:'inherit'});
