import test from 'node:test';
import assert from 'node:assert/strict';
import { InputRouter, resolveKeyInput, DEFAULT_KEY_BINDINGS } from '../dist/core.js';
import { BrowserKeyboardInput, DomUi } from '../dist/web.js';
function key(target,k,props={}) { const e=new Event('keydown',{cancelable:true});Object.assign(e,{key:k,...props});target.dispatchEvent(e);return e; }
test('default physical input resolves context-specific ADV actions',()=>{
  assert.equal(resolveKeyInput({key:'Enter'},'line'),'advance');assert.equal(resolveKeyInput({key:'Enter'},'choice'),'confirm');
  assert.equal(resolveKeyInput({key:'Escape'},'overlay'),'cancel');assert.equal(resolveKeyInput({key:'Escape'},'line'),'menu');
  for(const [k,action] of [[' ','advance'],['ArrowRight','advance'],['ArrowUp','up'],['ArrowDown','down'],['l','log'],['a','auto'],['s','skip'],['F5','quickSave'],['F9','quickLoad']])assert.equal(resolveKeyInput({key:k}),action);
  assert.equal(Object.isFrozen(DEFAULT_KEY_BINDINGS),true);
});
test('IME composition, key repeats and modified shortcuts do not advance',()=>{
  for(const props of [{composing:true},{repeat:true},{ctrl:true},{alt:true},{meta:true},{shift:true}])assert.equal(resolveKeyInput({key:'Enter',...props}),undefined);
  assert.equal(resolveKeyInput({key:'ArrowDown',repeat:true},'line',[{key:'ArrowDown',action:'down',allowRepeat:true}]),'down');
});
test('custom mapping and touch-style dispatch share one action boundary',()=>{
  const router=new InputRouter(),seen=[];router.subscribe(a=>{seen.push(a);return true;});
  const action=resolveKeyInput({key:'z'},'line',[{key:'z',action:'advance'}]);router.dispatch(action);router.dispatch('advance');assert.deepEqual(seen,['advance','advance']);
});
test('priority handlers consume actions and unsubscribe restores routing',()=>{
  const router=new InputRouter(),seen=[];router.subscribe(a=>{seen.push('game');return true;});const off=router.subscribe(a=>{seen.push('overlay');return true;},10);
  assert.equal(router.dispatch('advance'),true);off();router.dispatch('advance');assert.deepEqual(seen,['overlay','game']);
  const empty=new InputRouter();assert.equal(empty.dispatch('menu'),false);
});
test('browser keyboard only prevents handled actions and detaches on destroy',()=>{
  const target=new EventTarget(),router=new InputRouter(),seen=[];router.subscribe(a=>{seen.push(a);return a==='advance';});const input=new BrowserKeyboardInput(router,{target});
  assert.equal(key(target,'Enter').defaultPrevented,true);assert.equal(key(target,'Escape').defaultPrevented,false);assert.equal(key(target,'Enter',{repeat:true}).defaultPrevented,false);
  input.destroy();key(target,'Enter');assert.deepEqual(seen,['advance','menu']);
});
test('browser input leaves editable controls and native buttons alone',()=>{
  const target=new EventTarget(),router=new InputRouter();let calls=0;router.subscribe(()=>{calls++;return true;});const input=new BrowserKeyboardInput(router,{target});
  const e=new Event('keydown',{cancelable:true});Object.defineProperties(e,{key:{value:'Enter'},target:{value:{closest:()=>({})}}});target.dispatchEvent(e);assert.equal(calls,0);assert.equal(e.defaultPrevented,false);input.destroy();
});
class Element extends EventTarget {dataset={};textContent='';hidden=false;style={setProperty(){}};children=[];setAttribute(){};replaceChildren(){this.children=[];}append(c){this.children.push(c);}focus(){this.dispatchEvent(new Event('focus'));}click(){this.dispatchEvent(new Event('click'));}contains(e){return this.children.includes(e);} }
function dom(t,input){const previous={window:globalThis.window,document:globalThis.document,getComputedStyle:globalThis.getComputedStyle};globalThis.window=new EventTarget();globalThis.document={createElement:()=>new Element()};globalThis.getComputedStyle=()=>({getPropertyValue:()=> '0ms'});t.after(()=>{for(const [k,v] of Object.entries(previous))if(v===undefined)delete globalThis[k];else globalThis[k]=v;});const elements=Object.fromEntries(['root','background','speaker','text','choices'].map(k=>[k,new Element()]));return {elements,ui:new DomUi(elements,{input,keyboard:false})};}
test('actions advance exactly once and a stale handler cannot advance the next line',async t=>{
  const input=new InputRouter(),{elements,ui}=dom(t,input);let count=0;const first=ui.presentLine({text:'hello'}).then(()=>count++);
  input.dispatch('advance');input.dispatch('advance');await first;assert.equal(count,1);assert.equal(input.dispatch('advance'),false);
  const second=ui.presentLine({text:'done'});assert.equal(input.dispatch('advance'),true);await second;assert.equal(elements.text.textContent,'done');
});
test('action-based choice navigation confirms the focused item once',async t=>{
  const input=new InputRouter(),{ui}=dom(t,input);const choice=ui.presentChoice({options:['A','B','C']});input.dispatch('down');input.dispatch('down');input.dispatch('up');input.dispatch('confirm');input.dispatch('confirm');assert.equal(await choice,1);assert.equal(input.dispatch('confirm'),false);
});
test('high priority menu blocks action advance while open',async t=>{
  const input=new InputRouter(),{ui}=dom(t,input);const pending=ui.presentLine({text:'hello'});let done=false;pending.then(()=>done=true);
  const close=input.subscribe(()=>true,10);input.dispatch('advance');await Promise.resolve();assert.equal(done,false);close();input.dispatch('advance');await pending;
});
