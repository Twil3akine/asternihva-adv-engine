import test from 'node:test';import assert from 'node:assert/strict';import {SaveStore} from '../dist/core.js';import {SaveLoadPanel} from '../dist/web.js';
const state={version:1,scenarioId:'sample',runtime:{sceneId:'scene-a',nodeIndex:0,state:{}},presentation:{characters:[]},ended:false};
const tick=()=>new Promise(r=>setTimeout(r,0));
class Element extends EventTarget {children=[];dataset={};open=false;disabled=false;isConnected=true;attributes={};append(...items){this.children.push(...items);}replaceChildren(){this.children=[];}setAttribute(k,v){this.attributes[k]=v;}focus(){globalThis.document.activeElement=this;}showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent(new Event('close'));}remove(){this.isConnected=false;}querySelectorAll(selector){return this.children.flatMap(c=>[...(c.tag==='button'?[c]:[]),...c.querySelectorAll(selector)]);}querySelector(selector){return this.querySelectorAll('button').find(b=>!b.disabled);}click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}}
function fixture(t,overrides={}){let panel;const previous={document:globalThis.document,HTMLElement:globalThis.HTMLElement};const opener=new Element();globalThis.HTMLElement=Element;globalThis.document={activeElement:opener,createElement:tag=>Object.assign(new Element(),{tag})};t.after(()=>{panel?.destroy();for(const [k,v]of Object.entries(previous))if(v===undefined)delete globalThis[k];else globalThis[k]=v;});const data=new Map(),saves=new SaveStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},'fixture'),host=new Element();panel=new SaveLoadPanel(host,{saves,onSave:s=>saves.save(s,state),onLoad:s=>saves.load(s),...overrides});return{panel,saves,data,opener};}
const rows=panel=>panel.element.children[1].children;
test('save panel displays five manual slots while load includes auto/quick and restores focus',async t=>{
 const {panel,opener}=fixture(t);await panel.open('save');assert.equal(rows(panel).length,5);assert.equal(document.activeElement.tag,'button');panel.close();assert.equal(document.activeElement,opener);await panel.open('load');assert.equal(rows(panel).length,7);assert.equal(rows(panel)[0].children[1].disabled,true);panel.handleAction('cancel');assert.equal(panel.element.open,false);
});
test('save/delete hooks update metadata and empty load slots remain disabled',async t=>{
 const {panel,saves}=fixture(t);await panel.open('save');rows(panel)[0].children[1].click();await tick();assert.equal(await saves.hasSave('manual-1'),true);assert.ok(rows(panel)[0].children[0].textContent.includes('sample'));rows(panel)[0].children[2].click();await tick();assert.equal(await saves.hasSave('manual-1'),false);await panel.open('load');assert.equal(rows(panel).find(r=>r.dataset.slot==='manual-1').children[1].disabled,true);
});
test('busy quicksave actions serialize; destruction ignores late callback completion',async t=>{
 let release,calls=0;const {panel}=fixture(t,{onSave:()=>{calls++;return new Promise(r=>release=r);}});panel.handleAction('quickSave');panel.handleAction('quickSave');assert.equal(calls,1);assert.equal(panel.busy,true);panel.destroy();release();await tick();assert.equal(panel.handleAction('quickSave'),false);assert.equal(panel.element.isConnected,false);
});
test('corrupt saves are visible/deletable and load errors remain readable',async t=>{
 const errors=[];const {panel,data}=fixture(t,{onError:e=>errors.push(e)});data.set('fixture:save:manual-1','broken');await panel.open('load');const row=rows(panel).find(r=>r.dataset.slot==='manual-1');assert.ok(row.children[0].textContent.includes('Unreadable'));row.children[1].click();await tick();assert.equal(errors[0].code,'corrupted');assert.ok(panel.element.children[2].textContent.includes('corrupted'));assert.equal(panel.element.open,true);
});
test('stale slot buttons are inert after a mode change or panel close',async t=>{
 let calls=0;const {panel}=fixture(t,{onSave:async()=>calls++});await panel.open('save');const old=rows(panel)[0].children[1];await panel.open('load');old.dispatchEvent(new Event('click'));await tick();assert.equal(calls,0);panel.close();assert.equal(panel.handleAction('advance'),false);
});
