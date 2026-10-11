import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdvEngine, ScenarioCatalog, CharacterStage } from '../dist/core.js';

function fixture(nodes = [{type:'end'}]) {
  const calls = [], game = {scenario:{id:'sample',title:'Sample'},start:'scene-a',characters:[],scenes:{'scene-a':nodes}};
  const stage = {snapshot:()=>[],restore(){},setActive(){},destroy(){calls.push('stage');}};
  const ui = {presentEnd(){},setActiveSpeaker(){},destroy(){calls.push('ui');}};
  const audio = {snapshot:()=>({}),restore(){},destroy(){calls.push('audio');}};
  const options = {stage,ui,audio,progress:{markPlayed(){},markCompleted(){calls.push('clear');}}};
  return {calls,game,stage,ui,audio,options,engine:new AdvEngine({game,...options})};
}
for (const implicit of [false,true]) {
  for (const cancel of ['stop','destroy']) test(`${implicit?'implicit exhaustion':'End'} cancelled by ${cancel} never marks CLEAR`, async () => {
    const f=fixture(implicit?[]:[{type:'end'}]);
    let entered,release;const gate=new Promise(r=>entered=r);
    f.ui.presentEnd=()=>{entered();return new Promise(r=>release=r);};
    const run=f.engine.run();await gate;
    assert.equal(f.engine.ended,true);assert.equal(f.calls.includes('clear'),false);
    f.engine[cancel]();release();await run;
    assert.equal(f.calls.includes('clear'),false);assert.equal(f.engine.ended,true);
    f.engine.destroy();
  });
  test(`${implicit?'implicit exhaustion':'End'} marks CLEAR once after presentation succeeds`,async()=>{
    const f=fixture(implicit?[]:[{type:'end'}]);
    let entered,release;const gate=new Promise(r=>entered=r);
    f.ui.presentEnd=()=>{entered();return new Promise(r=>release=r);};
    const run=f.engine.run();await gate;assert.equal(f.calls.includes('clear'),false);
    release();await run;await f.engine.run();
    assert.equal(f.calls.filter(x=>x==='clear').length,1);f.engine.destroy();
  });
  test(`${implicit?'implicit exhaustion':'End'} cancellation also handles rejection of the pending UI promise`,async()=>{
    const f=fixture(implicit?[]:[{type:'end'}]);let entered,reject;
    const gate=new Promise(r=>entered=r);
    f.ui.presentEnd=()=>{entered();return new Promise((_resolve,r)=>reject=r);};
    const run=f.engine.run();await gate;f.engine.stop();reject(new Error('cancelled UI'));
    await assert.doesNotReject(run);assert.equal(f.calls.includes('clear'),false);f.engine.destroy();
  });
}
test('failed End presentation never marks CLEAR',async()=>{
  const f=fixture(),error=new Error('end failed');f.ui.presentEnd=async()=>{throw error;};
  await assert.rejects(f.engine.run(),e=>e===error);assert.equal(f.calls.includes('clear'),false);f.engine.destroy();
});

test('catalog destroys an engine rejected by restore preflight',async()=>{
  const f=fixture(),saved=f.engine.createSaveState();saved.runtime.sceneId='missing';
  const catalog=new ScenarioCatalog([{id:'sample',entry:f.game}]);
  await assert.rejects(catalog.loadScenario('manual-1',{...f.options,saves:{load:async()=>({state:saved})}}),e=>e.code==='corrupted');
  assert.deepEqual(f.calls,['stage','ui','audio']);assert.equal(catalog.getCurrentScenario(),undefined);
});
test('catalog cleans all resources after adapter restore failure',async()=>{
  const f=fixture(),saved=f.engine.createSaveState(),error=new Error('restore failed');
  f.stage.restore=async()=>{throw error;};
  const catalog=new ScenarioCatalog([{id:'sample',entry:f.game}]);
  await assert.rejects(catalog.loadScenario('manual-1',{...f.options,saves:{load:async()=>({state:saved})}}),e=>e===error);
  assert.deepEqual(f.calls,['stage','ui','audio']);
});
test('cleanup errors never hide the original load error and later resources still dispose',async()=>{
  const f=fixture(),saved=f.engine.createSaveState(),original=new Error('original'),cleanup=new Error('cleanup');
  f.stage.restore=()=>{throw original;};f.stage.destroy=()=>{f.calls.push('stage');throw cleanup;};
  f.ui.cancelPending=()=>{throw cleanup;};
  const catalog=new ScenarioCatalog([{id:'sample',entry:f.game}]);
  // Initial cancelPending also fails; its error must be preserved.
  await assert.rejects(catalog.loadScenario('manual-1',{...f.options,saves:{load:async()=>({state:saved})}}),e=>e===cleanup);
  assert.deepEqual(f.calls,['stage','ui','audio']);
  delete f.ui.cancelPending;f.calls.length=0;
  await assert.rejects(catalog.loadScenario('manual-1',{...f.options,saves:{load:async()=>({state:saved})}}),e=>e===original);
  assert.deepEqual(f.calls,['stage','ui','audio']);
});
test('successful catalog load transfers ownership and repeated destroy is idempotent',async()=>{
  const f=fixture(),saved=f.engine.createSaveState(),catalog=new ScenarioCatalog([{id:'sample',entry:f.game}]);
  const play=await catalog.loadScenario('manual-1',{...f.options,saves:{load:async()=>({state:saved})}});
  await play.finished;assert.deepEqual(f.calls,['clear']);
  play.engine.destroy();play.engine.destroy();assert.deepEqual(f.calls,['clear','stage','ui','audio']);
});
test('destroy remains idempotent after a disposer throws',()=>{
  const f=fixture(),error=new Error('cleanup');f.stage.destroy=()=>{f.calls.push('stage');throw error;};
  assert.throws(()=>f.engine.destroy(),e=>e===error);assert.doesNotThrow(()=>f.engine.destroy());
  assert.deepEqual(f.calls,['stage','ui','audio']);
});

test('failed catalog load releases every stage instance even if the first destroy throws',async()=>{
  const f=fixture(),original=new Error('restore'),cleanup=new Error('cleanup');
  f.game.characters=['alice','bob'].map(id=>({id,name:id,renderer:'mock'}));
  const stage=new CharacterStage({},f.game.characters,[{key:'mock',create(_host,character){return {
    setPosition(){throw original;},show(){},hide(){},setExpression(){},
    destroy(){f.calls.push(character.id);if(character.id==='alice')throw cleanup;},
  };}}]);
  const source=new AdvEngine({game:f.game,...f.options,stage}),saved=source.createSaveState();
  const catalog=new ScenarioCatalog([{id:'sample',entry:f.game}]);
  await assert.rejects(catalog.loadScenario('manual-1',{...f.options,stage,saves:{load:async()=>({state:saved})}}),e=>e===original);
  assert.deepEqual(f.calls,['alice','bob','ui','audio']);assert.doesNotThrow(()=>stage.destroy());
});
