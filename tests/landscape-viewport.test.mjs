import test from 'node:test';
import assert from 'node:assert/strict';
import { fitGameViewport, LandscapeViewport } from '../dist/web.js';

test('phone game rectangle stays inside asymmetric notch and home indicator bounds', () => {
  const result = fitGameViewport(844,390,{left:44,right:0,bottom:21});
  assert(result.width <= 800 && result.height <= 369);
  assert(Math.abs(result.width/result.height - 16/9) < 1e-9);
});
test('width-limited desktop keeps 16:9 without exceeding the available height', () => {
  assert.deepEqual(fitGameViewport(960,1080),{width:960,height:540});
});
test('safe area larger than the visible viewport cannot create negative geometry', () => {
  assert.deepEqual(fitGameViewport(20,20,{left:30,bottom:30}),{width:0,height:0});
});
test('non-finite dimensions are rejected instead of emitting invalid CSS', () => {
  assert.throws(()=>fitGameViewport(NaN,390),TypeError);
  assert.throws(()=>fitGameViewport(844,Infinity),TypeError);
});
test('negative insets are rejected rather than widening the unsafe rectangle', () => {
  assert.throws(()=>fitGameViewport(844,390,{left:-1}),TypeError);
});
function fixture(t,{width=844,height=390,inert=false}={}) {
  const names=['window','document','HTMLElement','getComputedStyle'], previous=Object.fromEntries(names.map(n=>[n,globalThis[n]]));
  class Element extends EventTarget {
    dataset={}; inert=false; isConnected=true; open=false; textContent=''; classes=new Set(); values=new Map(); priorities=new Map();
    classList={contains:n=>this.classes.has(n),add:n=>this.classes.add(n),remove:n=>this.classes.delete(n)};
    style={getPropertyValue:n=>this.values.get(n)??'',getPropertyPriority:n=>this.priorities.get(n)??'',setProperty:(n,v,p='')=>{this.values.set(n,v);this.priorities.set(n,p);},removeProperty:n=>this.values.delete(n)};
    setAttribute(){} showModal(){this.open=true;} close(){this.open=false;} focus(){globalThis.document.activeElement=this;} append(){} remove(){this.isConnected=false;}
  }
  const shell=new Element(),root=new Element(),opener=new Element();root.parentElement=shell;root.inert=inert;
  const viewport=Object.assign(new EventTarget(),{width,height,offsetTop:0,offsetLeft:0});
  globalThis.HTMLElement=Element;
  globalThis.window=Object.assign(new EventTarget(),{innerWidth:width,innerHeight:height,visualViewport:viewport});
  globalThis.document={body:shell,activeElement:opener,createElement:()=>new Element()};
  globalThis.getComputedStyle=element=>element.style;
  t.after(()=>{for(const name of names){if(previous[name]===undefined)delete globalThis[name];else globalThis[name]=previous[name];}});
  return {root,shell,opener,viewport,resize(w,h){window.innerWidth=viewport.width=w;window.innerHeight=viewport.height=h;window.dispatchEvent(new Event('resize'));}};
}
test('portrait creates a blocking native overlay with host-customized text', t => {
  const f=fixture(t,{width:390,height:844}), view=new LandscapeViewport(f.root,{message:'Rotate to play'});
  assert.equal(view.element.textContent,'Rotate to play');assert(view.element.open);assert(f.root.inert);assert.equal(f.root.dataset.orientation,'portrait');view.destroy();
});
test('rotation restores focus and emits changes once, so host mode cancellation is stable', t => {
  const f=fixture(t),changes=[],view=new LandscapeViewport(f.root,{onOrientationChange:value=>changes.push(value)});
  f.resize(390,844);f.resize(391,844);assert(view.element.open);f.resize(844,390);
  assert(!view.element.open);assert(!f.root.inert);assert.equal(document.activeElement,f.opener);assert.deepEqual(changes,[false,true,false]);view.destroy();
});
test('visual viewport resize and pan update geometry without misclassifying keyboard orientation', t => {
  const f=fixture(t),view=new LandscapeViewport(f.root);
  f.viewport.height=220;f.viewport.offsetTop=12;f.viewport.dispatchEvent(new Event('resize'));
  assert.equal(f.shell.style.getPropertyValue('--adv-visible-height'),'220px');assert.equal(f.shell.style.getPropertyValue('--adv-visible-top'),'12px');
  assert.equal(f.root.dataset.orientation,'landscape');assert(parseFloat(f.root.style.getPropertyValue('--adv-fitted-width'))<=220*16/9);
  f.viewport.offsetLeft=4;f.viewport.dispatchEvent(new Event('scroll'));assert.equal(f.shell.style.getPropertyValue('--adv-visible-left'),'4px');view.destroy();
});
test('destroy preserves host CSS, prior inert/orientation state and removes viewport listeners', t => {
  const f=fixture(t,{width:390,height:844,inert:true});f.shell.style.setProperty('--adv-visible-height','50vh','important');f.root.dataset.orientation='custom';
  const view=new LandscapeViewport(f.root);view.destroy();view.destroy();f.resize(844,390);
  assert(f.root.inert);assert.equal(f.root.dataset.orientation,'custom');assert.equal(f.shell.style.getPropertyValue('--adv-visible-height'),'50vh');assert.equal(f.shell.style.getPropertyPriority('--adv-visible-height'),'important');
  assert(!f.shell.classList.contains('adv-viewport-shell'));assert(!view.element.isConnected);
});
test('Escape cannot dismiss the portrait overlay and leave tiny controls accessible', t => {
  const f=fixture(t,{width:390,height:844}),view=new LandscapeViewport(f.root),event=new Event('cancel',{cancelable:true});
  view.element.dispatchEvent(event);assert(event.defaultPrevented);assert(view.element.open);view.destroy();
});
test('a root that is also its own shell is rejected before mutation', t => {
  const f=fixture(t);assert.throws(()=>new LandscapeViewport(f.root,{shell:f.root}),TypeError);assert(!f.root.classList.contains('adv-viewport-shell'));
});

test('portrait blocks background global key handlers without disabling browser modifier shortcuts', t => {
  const f=fixture(t,{width:390,height:844}),view=new LandscapeViewport(f.root);let calls=0;
  window.addEventListener('keydown',()=>calls++);
  const key=new Event('keydown',{cancelable:true});window.dispatchEvent(key);assert(key.defaultPrevented);assert.equal(calls,0);
  const modified=new Event('keydown',{cancelable:true});Object.defineProperty(modified,'ctrlKey',{value:true});window.dispatchEvent(modified);assert(!modified.defaultPrevented);assert.equal(calls,0);
  view.destroy();window.dispatchEvent(new Event('keydown'));assert.equal(calls,1);
});
