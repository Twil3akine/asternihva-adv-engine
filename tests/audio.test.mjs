import test from 'node:test';import assert from 'node:assert/strict';
import { AudioController, AdvEngine, CharacterStage, SaveStore, validateSaveState } from '../dist/core.js';
import { BrowserAudioAdapter, GameSettingsStore } from '../dist/web.js';
const tick=()=>new Promise(r=>setTimeout(r,0));
function mock(){const calls=[];return {calls,adapter:{play:(...a)=>{calls.push(['play',...a]);},stop:(...a)=>{calls.push(['stop',...a]);},setVolume:(...a)=>calls.push(['volume',...a]),destroy:()=>calls.push(['destroy'])}};}
test('audio channels use consistent master × channel volume and BGM logical state',async()=>{
  const {adapter,calls}=mock(),audio=new AudioController(adapter);audio.setVolumes({master:.5,bgm:.4,se:.6,voice:.8});assert.deepEqual(calls.slice(-3),[['volume','bgm',.2],['volume','se',.3],['volume','voice',.4]]);
  await audio.play('bgm','music',{fadeInMs:200,crossfadeMs:300,volume:.7});assert.deepEqual(audio.snapshot(),{bgm:{id:'music',loop:true,volume:.7}});await audio.stop('bgm',{fadeOutMs:100});assert.deepEqual(audio.snapshot(),{});
});
test('voice line change stop policy is configurable and SE does not enter save state',async()=>{
  const {adapter,calls}=mock(),audio=new AudioController(adapter);await audio.play('se','click');await audio.play('voice','voice-a');await audio.lineChanged();assert.equal(calls.at(-1)[1],'voice');assert.deepEqual(audio.snapshot(),{});
  const other=new AudioController(adapter,false);const count=calls.length;await other.lineChanged();assert.equal(calls.length,count);
});
test('audio restore stops one-shots and resumes only BGM from its beginning',async()=>{
  const {adapter,calls}=mock(),audio=new AudioController(adapter);await audio.restore({bgm:{id:'music',volume:.5,loop:false}});assert.deepEqual(calls.slice(-4).map(c=>c.slice(0,2)),[['stop','voice'],['stop','se'],['stop','bgm'],['play','bgm']]);
});
test('invalid volumes and timing fail before adapter mutation',async()=>{
  const {adapter,calls}=mock(),audio=new AudioController(adapter);const count=calls.length;
  assert.throws(()=>audio.setVolumes({master:NaN,bgm:1,se:1,voice:1}),TypeError);assert.throws(()=>audio.setVolumes({master:1,bgm:2,se:1,voice:1}),TypeError);
  await assert.rejects(audio.play('bgm','music',{fadeInMs:-1}),TypeError);await assert.rejects(audio.play('se','click',{volume:2}),TypeError);assert.equal(calls.length,count);
});
test('concurrent BGM completion cannot replace newer logical state',async()=>{
  const {adapter}=mock();let release;adapter.play=(_c,id)=>id==='old'?new Promise(r=>release=r):undefined;const audio=new AudioController(adapter);const old=audio.play('bgm','old');await audio.play('bgm','new');release();await old;assert.equal(audio.snapshot().bgm.id,'new');
});
test('settings retain legacy shape, persist audio, freeze it and bind channel gain',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},store=new GameSettingsStore(storage);assert.equal(store.value.audio,undefined);
  const {adapter}=mock(),audio=new AudioController(adapter),off=store.bindAudio(audio);store.update({audio:{master:.5,bgm:.5,se:.5,voice:.5}});assert.equal(audio.volumes.master,.5);assert.equal(Object.isFrozen(store.value.audio),true);assert.equal(new GameSettingsStore(storage).value.audio.master,.5);off();
  assert.throws(()=>store.update({audio:{master:2,bgm:1,se:1,voice:1}}),/invalid/);
});
function context(){const sources=[],gains=[];return {sources,gains,currentTime:1,destination:{},resume:async()=>{},close:async()=>{},decodeAudioData:async()=>({length:1}),createBufferSource(){const s={connect(){},disconnect(){},start(){s.started=true;},stop(t){s.stopAt=t;},loop:false};sources.push(s);return s;},createGain(){const g={calls:[],connect(){},disconnect(){},gain:{value:1,setValueAtTime:(...a)=>g.calls.push(['set',...a]),linearRampToValueAtTime:(...a)=>g.calls.push(['ramp',...a]),cancelScheduledValues:(...a)=>g.calls.push(['cancel',...a])}};gains.push(g);return g;}};}
test('browser audio overlaps SE, caches decoding and replaces voice',async()=>{
  const ctx=context();let loads=0;const web=new BrowserAudioAdapter({assets:{click:'click.wav',voice:'voice.wav'},createContext:()=>ctx,load:async()=>{loads++;return new ArrayBuffer(1);}});
  await Promise.all([web.play('se','click'),web.play('se','click')]);assert.equal(ctx.sources.length,2);assert.equal(loads,1);assert.ok(ctx.sources.every(s=>s.started&&s.stopAt===undefined));await web.play('voice','voice');await web.play('voice','voice');assert.equal(ctx.sources[2].stopAt,1);web.destroy();
});
test('browser audio fade/crossfade schedule gains and stop times',async()=>{
  const ctx=context(),web=new BrowserAudioAdapter({assets:{a:'a.wav',b:'b.wav'},createContext:()=>ctx,load:async()=>new ArrayBuffer(1)});
  await web.play('bgm','a',{fadeInMs:200});assert.deepEqual(ctx.gains[0].calls.slice(0,2),[['set',0,1],['ramp',1,1.2]]);
  await web.play('bgm','b',{crossfadeMs:500});assert.equal(ctx.sources[0].stopAt,1.5);assert.deepEqual(ctx.gains[1].calls.slice(0,2),[['set',0,1],['ramp',1,1.5]]);web.stop('bgm',{fadeOutMs:100});assert.equal(ctx.sources[1].stopAt,1.1);
});
test('stopped pending decode never starts and failed decode may retry',async()=>{
  const ctx=context();let release,count=0;const web=new BrowserAudioAdapter({assets:{a:'a.wav'},createContext:()=>ctx,load:()=>{count++;if(count===1)return new Promise(r=>release=r);return Promise.resolve(new ArrayBuffer(1));}});
  const pending=web.play('bgm','a');web.stop('bgm');release(new ArrayBuffer(1));await pending;assert.equal(ctx.sources.length,0);
  await assert.rejects(web.play('se','missing'),/Unknown/);
  let attempts=0;const failed=new BrowserAudioAdapter({assets:{a:'a.wav'},createContext:()=>ctx,load:async()=>{if(++attempts===1)throw Error('failure');return new ArrayBuffer(1);}});await assert.rejects(failed.play('se','a'));await failed.play('se','a');assert.equal(attempts,2);
});
test('destroyed audio rejects further playback and ignores pending decode',async()=>{
  const ctx=context();let release;const web=new BrowserAudioAdapter({assets:{a:'a.wav'},createContext:()=>ctx,load:()=>new Promise(r=>release=r)});const pending=web.play('bgm','a');web.destroy();release(new ArrayBuffer(1));await pending;assert.equal(ctx.sources.length,0);await assert.rejects(web.play('se','a'),/destroyed/);
});
test('scenario audio and line voice integrate with Save/Load without assets or positions',async()=>{
  const {adapter,calls}=mock(),audio=new AudioController(adapter),storage=new Map(),saves=new SaveStore({getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},'fixture');
  const stage=new CharacterStage({},[],[]);let line;const ui={presentLine:()=>new Promise(r=>line=r),presentEnd(){}};
  const game={scenario:{id:'sample'},start:'scene-a',characters:[],scenes:{'scene-a':[{type:'audio',channel:'bgm',id:'music'},{type:'line',text:'hello',voice:'voice-a'},{type:'end'}]}};
  const engine=new AdvEngine({game,stage,ui,saves,audio});const run=engine.run();await tick();await engine.save('quicksave');const record=await saves.load('quicksave');assert.deepEqual(record.state.audio,{bgm:{id:'music',loop:true,volume:1}});assert.ok(calls.some(c=>c[0]==='play'&&c[1]==='voice'));
  await engine.load('quicksave');await run;assert.equal(audio.snapshot().bgm.id,'music');engine.destroy();
  assert.throws(()=>validateSaveState({...record.state,audio:{bgm:{id:'music',loop:true,volume:Infinity}}}),e=>e.code==='corrupted');
});
