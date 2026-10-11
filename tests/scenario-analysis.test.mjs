import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {execFileSync,spawnSync} from 'node:child_process';
import {validateScenarios,scenarioStatistics,scenarioGraph,scenarioGraphDot} from '../dist/tooling/index.js';
const game=()=>({scenario:{id:'sample',title:'Sample'},start:'scene-a',characters:[{id:'alice',name:'Alice',renderer:'sprite',defaultExpression:'normal',assets:{expressions:{normal:'alice.png',smile:'smile.png'},motions:{wave:{}}}}],backgrounds:{room:{src:'room.png'}},stageLayouts:{solo:{members:[{character:'alice'}]}},scenes:{'scene-a':[{type:'line',speaker:'alice',text:'hello😀'},{type:'choice',prompt:'go?',options:[{text:'A',next:'end'},{text:'B',next:'end#1'}]}],end:[{type:'end'}]}});
const validate=(g,options)=>validateScenarios([{id:'sample',title:'Sample',entry:g}],options);
test('statistics count Unicode characters and all authored branches with explicit reading-speed estimate',()=>{
 const stats=scenarioStatistics(game());assert.deepEqual(stats,{scenes:2,lines:1,characters:1,choices:1,branches:2,textCharacters:11,approximateReadingMinutes:.1});assert.throws(()=>scenarioStatistics(game(),0),TypeError);
});
test('graph exports only structure, includes natural termination and has JSON/DOT escaping',()=>{
 const g=game(),graph=scenarioGraph(g);assert.equal(graph.start,'scene-a#0');assert.ok(graph.nodes.some(n=>n.id==='end#1'&&n.type==='terminal'));assert.equal(graph.edges.filter(e=>e.kind==='choice').length,2);assert.equal(JSON.stringify(graph).includes('hello'),false);assert.equal(JSON.stringify(graph).includes('alice.png'),false);assert.match(scenarioGraphDot(g),/digraph scenario/);
 g.start='a"b';g.scenes={'a"b':[{type:'line',text:'hello'}]};assert.ok(scenarioGraphDot(g).includes('a\\"b#0'));
});
test('empty choices error and duplicate/blank labels warn without quoting labels',()=>{
 const g=game();g.scenes['scene-a']=[{type:'choice',options:[]}];assert.ok(validate(g).diagnostics.some(d=>d.message==='choice has no options'&&d.severity==='error'));
 g.scenes['scene-a']=[{type:'choice',options:[{text:'A',next:'end'},{text:'A',next:'end'},{text:'',next:'end'}]}];const r=validate(g);assert.equal(r.errors,0);assert.ok(r.diagnostics.some(d=>d.message==='choice has duplicate labels'));assert.ok(r.diagnostics.some(d=>d.message==='choice has an empty label'));
});
test('duplicate character IDs error before registry references are checked',()=>{const g=game();g.characters.push(g.characters[0]);assert.ok(validate(g).diagnostics.some(d=>d.message==='duplicate character id'));});
test('automatic loop errors but an unreachable loop only warns',()=>{
 const g=game();g.scenes['scene-a']=[{type:'set',values:{a:1},next:'scene-a'}];assert.ok(validate(g).diagnostics.some(d=>d.message.includes('infinite deterministic loop')));
 g.scenes['scene-a']=[{type:'end'}];g.scenes.unused=[{type:'jump',next:'unused'}];assert.equal(validate(g).errors,0);
});
test('lint warnings include empty scene, unused registries and unreachable nodes',()=>{
 const g=game();g.scenes.empty=[];g.scenes['scene-a'].push({type:'choice',options:[{text:'unreachable',next:'end'}]});const r=validate(g,{lint:true});for(const text of ['empty scene','unused expression','unused motion','unused background','unused layout','unreachable node'])assert.ok(r.diagnostics.some(d=>d.message.includes(text)),text);
 const unused=game();unused.scenes['scene-a']=[{type:'end'}];assert.ok(validate(unused,{lint:true}).diagnostics.some(d=>d.message==='unused character'));
});
test('malformed authoring data reports an error rather than throwing',()=>{
 for(const scenes of [null,{'scene-a':null},{'scene-a':[null]},{'scene-a':[{type:'line',text:7}]},{'scene-a':[{type:'choice',options:null}]},{'scene-a':[{type:'unknown'}]}])assert.equal(validate({...game(),scenes}).valid,false);
});
test('CLI validates, counts and exports generic trusted modules without their text',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'adv-scenario-'));t.after(()=>rm(dir,{recursive:true,force:true}));const module=join(dir,'sample.mjs');await writeFile(module,'export default '+JSON.stringify(game()));
 const run=(...args)=>execFileSync(process.execPath,['scripts/cli.mjs','scenario',...args],{encoding:'utf8'});
 assert.equal(JSON.parse(run('validate',module)).valid,true);assert.equal(JSON.parse(run('stats',module))[0].lines,1);const path=join(dir,'graph.json');run('graph',module,path);assert.equal((await readFile(path,'utf8')).includes('hello'),false);run('graph',module,join(dir,'graph.dot'));
 await writeFile(module,'export default { broken: "private placeholder" ');const failed=spawnSync(process.execPath,['scripts/cli.mjs','scenario','validate',module],{encoding:'utf8'});assert.equal(failed.status,1);assert.equal(failed.stderr.includes('private placeholder'),false);
});
