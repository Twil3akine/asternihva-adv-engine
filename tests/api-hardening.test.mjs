import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {SpriteRenderer,DecodedImageCache} from '../dist/web.js';
test('transitive core source boundary excludes DOM imports and types',()=>{execFileSync(process.execPath,['scripts/verify-core.mjs'],{stdio:'inherit'});});
test('generic validation and runtime behavior work outside the browser',()=>{for(const script of ['scripts/validate-fixture.mjs','scripts/compatibility-smoke.mjs'])execFileSync(process.execPath,[script],{stdio:'inherit'});});
test('destroyed sprites neither acquire new images nor reactivate while initialization resolves',async t=>{
 const previous=globalThis.document;const decodes=[];class Element{dataset={};style={setProperty(){},removeProperty(){}};append(){};remove(){};setAttribute(){};set src(v){this.source=v;}decode(){return new Promise(r=>decodes.push(r));}}
 globalThis.document={createElement:()=>new Element()};t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
 const cache=new DecodedImageCache(),renderer=new SpriteRenderer({imageCache:cache});const character=renderer.create(new Element(),{id:'alice',name:'Alice',renderer:'sprite',assets:{expressions:{normal:'normal.svg',smile:'smile.svg'}}});
 const show=character.show();character.destroy();decodes[0]();await show;await character.setExpression('smile');await character.show();assert.equal(cache.stats.misses,1);assert.equal(cache.stats.pinnedImages,0);character.destroy();
});
test('unchecked deterministic loops fail instead of starving the host',async()=>{
 const {AdvEngine,CharacterStage}=await import('../dist/core.js');const engine=new AdvEngine({game:{start:'scene-a',characters:[],scenes:{'scene-a':[{type:'jump',next:'scene-a'}]}},stage:new CharacterStage({},[],[]),ui:{presentEnd(){}},maxAutomaticSteps:5});await assert.rejects(engine.run(),/Maximum automatic steps/);
 assert.throws(()=>new AdvEngine({game:{start:'scene-a',characters:[],scenes:{}},stage:new CharacterStage({},[],[]),ui:{},maxAutomaticSteps:0}),TypeError);
});
test('duplicate stage registries reject before renderer allocation',async()=>{
 const {CharacterStage}=await import('../dist/core.js');let creations=0;const renderer={key:'mock',create(){creations++;return {};}};const character={id:'alice',name:'Alice',renderer:'mock'};assert.throws(()=>new CharacterStage({},[character,character],[renderer]),/Duplicate character/);assert.throws(()=>new CharacterStage({},[character],[renderer,renderer]),/Duplicate renderer/);assert.equal(creations,0);
});
