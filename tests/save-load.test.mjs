import test from 'node:test';
import assert from 'node:assert/strict';
import { AdvEngine, CharacterStage, SaveStore, SaveError, ScenarioCatalog } from '../dist/core.js';
import { LocalStorageAdapter } from '../dist/web.js';
const memory = () => { const data = new Map(); return { data, getItem:k=>data.get(k)??null, setItem:(k,v)=>data.set(k,v), removeItem:k=>data.delete(k) }; };
const tick = () => new Promise(r => setTimeout(r,0));
function fixture(overrides={}) {
  const calls=[], pending=[];
  const game={scenario:{id:'sample',title:'Sample'},start:'scene-a',characters:[{id:'alice',name:'Alice',renderer:'mock',defaultExpression:'normal'}],
    backgrounds:{room:{src:'generated.svg'}}, stageLayouts:{solo:{members:[{character:'alice',position:'left'}]}}, initialState:{seen:false},
    scenes:{'scene-a':[{type:'scene',background:'room',layout:'solo',commands:[{character:'alice',expression:'smile'}]},
      {type:'line',speaker:'alice',text:'hello'}, {type:'choice',options:[{text:'go',next:'scene-b',set:{seen:true,route:'a'}}]}],
      'scene-b':[{type:'line',text:'done'},{type:'end'}]},...overrides.game};
  const renderer={key:'mock',create(){return Object.fromEntries(['show','hide','setExpression','setPosition','playMotion','stopMotion','destroy'].map(k=>[k,(v)=>{calls.push([k,v]);return overrides.effect?.(k,v);}]))}};
  const stage=new CharacterStage({},game.characters,[renderer]);
  const storage=memory(),saves=new SaveStore(storage,'sample-game');
  const ui={presentLine(line){pending.push({type:'line',line});return new Promise(r=>{pending.at(-1).resolve=r;});},presentChoice(choice){pending.push({type:'choice',choice});return new Promise(r=>{pending.at(-1).resolve=r;});},presentBackground(b){calls.push(['background',b]);},presentEnd(){calls.push(['end']);},cancelPending(){calls.push(['cancel']);}};
  const engine=new AdvEngine({game,stage,ui,saves,...overrides.options});
  return {game,stage,ui,engine,calls,pending,saves,storage};
}
async function atLine(f){f.run=f.engine.run();await tick();assert.equal(f.pending.at(-1).type,'line');}

test('save/load round trip restores variables, position, background, layout and character presentation',async()=>{
  const f=fixture();await atLine(f);await f.engine.save('manual-1');
  const record=await f.saves.load('manual-1');
  assert.deepEqual(record.state.runtime,{sceneId:'scene-a',nodeIndex:1,state:{seen:false}});
  assert.equal(record.state.presentation.background,'room');assert.equal(record.state.presentation.layout,'solo');
  assert.deepEqual(record.state.presentation.characters,[{character:'alice',position:'left',expression:'smile',visible:true}]);
  f.pending.at(-1).resolve();await tick();f.pending.at(-1).resolve(0);await tick();assert.equal(f.engine.state.seen,true);
  await f.engine.load('manual-1');await f.run;assert.equal(f.engine.state.seen,false);assert.equal(f.engine.snapshot().nodeIndex,1);
  await atLine(f);assert.equal(f.pending.at(-1).line.text,'hello');f.engine.stop();await f.run;
});
test('choice waiting state resumes the same choice and chosen variables survive autosave',async()=>{
  const f=fixture({options:{autosave:true}});await atLine(f);assert.equal((await f.saves.load('autosave')).state.runtime.nodeIndex,1);
  f.pending.at(-1).resolve();await tick();await f.engine.save('quicksave');
  assert.equal((await f.saves.load('quicksave')).state.runtime.nodeIndex,2);
  f.pending.at(-1).resolve(0);await tick();const auto=await f.saves.load('autosave');assert.equal(auto.state.runtime.sceneId,'scene-b');assert.equal(auto.state.runtime.state.route,'a');
  await f.engine.load('quicksave');await f.run;f.run=f.engine.run();await tick();assert.equal(f.pending.at(-1).type,'choice');
  f.engine.stop();await f.run;
});
test('old interaction cannot advance a loaded position',async()=>{
  const f=fixture();await atLine(f);await f.engine.save('manual-1');const old=f.pending.at(-1);
  await f.engine.load('manual-1');await f.run;await atLine(f);old.resolve();await tick();assert.equal(f.engine.snapshot().nodeIndex,1);f.engine.stop();await f.run;
});
test('save during a renderer transition rejects busy; load waits for it before rebuilding presentation',async()=>{
  let release,blocked=false;
  const f=fixture({effect(k){if(k==='setPosition'&&!blocked){blocked=true;return new Promise(r=>{release=r;});}}});
  const saved=f.engine.createSaveState();await f.saves.save('manual-1',saved);f.run=f.engine.run();await tick();
  assert.throws(()=>f.engine.save('quicksave'),e=>e.code==='busy');
  let loaded=false;const load=f.engine.load('manual-1').then(()=>{loaded=true;});await tick();assert.equal(loaded,false);release();await load;await f.run;
  assert.equal(f.engine.snapshot().nodeIndex,0);assert.equal(f.stage.snapshot()[0].visible,false);assert.equal(f.stage.snapshot()[0].position,'center');
});
test('completed saves restore completion and chapter progress',async()=>{
  const played=[],completed=[];const f=fixture({game:{scenes:{'scene-a':[{type:'end'}]}},options:{progress:{markPlayed:id=>played.push(id),markCompleted:id=>completed.push(id)}}});
  await f.engine.run();await f.engine.save('manual-1');await f.engine.load('manual-1');assert.equal(f.engine.ended,true);await f.engine.run();assert.deepEqual(completed,['sample']);assert.ok(played.length>=2);
});
for(const [name,change,code] of [
  ['corrupt JSON',()=>'{broken','corrupted'],
  ['unsupported version',r=>({...r,state:{...r.state,version:99}}),'unsupported-version'],
  ['missing scene',r=>({...r,state:{...r.state,runtime:{...r.state.runtime,sceneId:'missing'}}}),'corrupted'],
  ['negative index',r=>({...r,state:{...r.state,runtime:{...r.state.runtime,nodeIndex:-1}}}),'corrupted'],
  ['non-scalar variables',r=>({...r,state:{...r.state,runtime:{...r.state.runtime,state:{a:{}}}}}),'corrupted'],
  ['bad character',r=>({...r,state:{...r.state,presentation:{characters:[{character:'bob',visible:true,position:'center'}]}}}),'corrupted'],
  ['duplicate characters',r=>({...r,state:{...r.state,presentation:{characters:[r.state.presentation.characters[0],r.state.presentation.characters[0]]}}}),'corrupted'],
  ['wrong scenario',r=>({...r,state:{...r.state,scenarioId:'missing'}}),'scenario-missing'],
]) test(`rejects ${name} before changing running playback`,async()=>{
  const f=fixture();await atLine(f);await f.engine.save('manual-1');const r=await f.saves.load('manual-1');const changed=change(r);
  f.storage.data.set('sample-game:save:manual-1',typeof changed==='string'?changed:JSON.stringify(changed));
  await assert.rejects(f.engine.load('manual-1'),e=>e instanceof SaveError&&e.code===code);
  assert.equal(f.engine.snapshot().nodeIndex,1);f.engine.stop();await f.run;
});
test('slots support missing, list, has, deletion and isolated namespaces',async()=>{
  const f=fixture();await assert.rejects(f.saves.load('manual-1'),e=>e.code==='missing');await f.engine.save('manual-1');await f.engine.save('quicksave');
  assert.equal((await f.engine.listSaves()).length,2);assert.equal(await f.engine.hasSave('manual-1'),true);await f.engine.deleteSave('manual-1');assert.equal(await f.engine.hasSave('manual-1'),false);
  assert.equal(await new SaveStore(f.storage,'other').hasSave('quicksave'),false);await assert.rejects(f.saves.load('invalid'),e=>e.code==='invalid-slot');
  f.storage.data.set('sample-game:save:manual-1','bad');assert.equal((await f.engine.listSaves()).length,1);
});
test('catalog resolves saved scenario and reports missing entries',async()=>{
  const f=fixture();await f.engine.save('manual-1');const catalog=new ScenarioCatalog([{id:'sample',entry:f.game}]);
  const play=await catalog.loadScenario('manual-1',{saves:f.saves,stage:f.stage,ui:f.ui});await tick();assert.equal(catalog.getCurrentScenario().id,'sample');play.engine.stop();await play.finished;
  await assert.rejects(new ScenarioCatalog().loadScenario('manual-1',{saves:f.saves,stage:f.stage,ui:f.ui}),e=>e.code==='scenario-missing');
});
test('storage failures are typed and autosave failure does not interrupt playback',async()=>{
  const f=fixture();const errors=[];const saves=new SaveStore({getItem(){throw Error('read');},setItem(){throw Error('quota');},removeItem(){throw Error('write');}},'sample');
  await assert.rejects(saves.hasSave('manual-1'),e=>e.code==='storage');await assert.rejects(saves.deleteSave('manual-1'),e=>e.code==='storage');
  const engine=new AdvEngine({game:f.game,stage:f.stage,ui:f.ui,saves,autosave:true,onAutosaveError:e=>errors.push(e)});const run=engine.run();await tick();assert.equal(f.pending.at(-1).type,'line');assert.equal(errors[0].code,'storage');engine.stop();await run;
});
test('browser localStorage adapter supports injected storage without global DOM',async()=>{
  const storage=memory();const adapter=new LocalStorageAdapter(storage);adapter.setItem('key','hello');assert.equal(adapter.getItem('key'),'hello');adapter.removeItem('key');assert.equal(adapter.getItem('key'),null);
});
test('legacy restore refuses mutation during playback and validates the index',async()=>{
  const f=fixture();await atLine(f);assert.throws(()=>f.engine.restore(f.engine.snapshot()),e=>e.code==='busy');f.engine.stop();await f.run;
  assert.throws(()=>f.engine.restore({...f.engine.snapshot(),nodeIndex:NaN}),e=>e.code==='corrupted');
});
test('stop and immediate run cannot overlap a pending renderer effect',async()=>{
  let release;
  const f=fixture({effect(k){if(k==='setPosition')return new Promise(r=>{release=r;});}});
  const run=f.engine.run();await tick();f.engine.stop();assert.equal(f.engine.run(),run);release();await run;assert.equal(f.pending.length,0);
});
test('scalar variable keys cannot replace the runtime object prototype',()=>{
  const state=JSON.parse('{"__proto__":"hello","constructor":"safe"}');const f=fixture({game:{initialState:state}});
  assert.equal(Object.getPrototypeOf(f.engine.state),null);assert.equal(f.engine.snapshot().state.__proto__,'hello');
});

test('destroy during restore cancels before committing runtime state or progress', async () => {
  let release, entered;
  const gate = new Promise(resolve => { entered = resolve; });
  const played = [];
  const f = fixture({ effect(method) { if (method === 'setPosition') { entered(); return new Promise(resolve => { release = resolve; }); } }, options: { progress: { markPlayed: id => played.push(id), markCompleted() {} } } });
  const state = f.engine.createSaveState(); state.runtime.state.seen = true;
  const loading = f.engine.restoreSaveState(state);
  await gate;
  f.engine.destroy(); f.engine.destroy(); release();
  await assert.rejects(loading, error => error.code === 'busy');
  assert.equal(f.engine.state.seen, false);
  assert.deepEqual(played, []);
  assert.equal(f.calls.filter(([method]) => method === 'destroy').length, 1);
  assert.equal(f.calls.some(([method]) => method === 'background'), false);
  assert.throws(() => f.engine.createSaveState(), error => error.code === 'busy');
  await assert.rejects(f.engine.run(), /destroyed/);
});

test('stop during audio restoration blocks later presentation and permits a fresh load after settling', async () => {
  let release, entered;
  const gate = new Promise(resolve => { entered = resolve; });
  let blocked = true;
  const audio = { snapshot: () => ({}), restore() { if (blocked) { entered(); return new Promise(resolve => { release = resolve; }); } }, destroy() {} };
  const f = fixture({ options: { audio } });
  const state = f.engine.createSaveState(); state.runtime.state.seen = true;
  const loading = f.engine.restoreSaveState(state);
  await gate; f.engine.stop(); release();
  await assert.rejects(loading, error => error.code === 'busy');
  assert.equal(f.engine.state.seen, false);
  assert.equal(f.calls.some(([method]) => method === 'setPosition'), false);
  assert.throws(() => f.engine.createSaveState(), error => error.code === 'busy');
  blocked = false;
  await f.engine.restoreSaveState(state);
  assert.equal(f.engine.state.seen, true);
  assert.doesNotThrow(() => f.engine.createSaveState());
  f.engine.destroy();
});

test('a previous execution failure does not prevent restoring a valid checkpoint', async () => {
  const f = fixture({ game: { scenes: { 'scene-a': [{ type: 'jump', next: 'missing' }], 'scene-b': [{ type: 'line', text: 'hello' }] } } });
  const saved = f.engine.createSaveState(); saved.runtime.sceneId = 'scene-b';
  await assert.rejects(f.engine.run(), /Unknown jump target/);
  await f.engine.restoreSaveState(saved);
  await atLine(f);
  assert.equal(f.pending.at(-1).line.text, 'hello');
  f.engine.stop(); await f.run;
});

test('legacy restore waits for a stopped renderer transition to settle', async () => {
  let release;
  const f = fixture({ effect(method) { if (method === 'setPosition') return new Promise(resolve => { release = resolve; }); } });
  const saved = f.engine.snapshot(); const running = f.engine.run(); await tick(); f.engine.stop();
  assert.throws(() => f.engine.restore(saved), error => error.code === 'busy');
  release(); await running;
  assert.doesNotThrow(() => f.engine.restore(saved));
  f.engine.destroy();
});

 test('scene exhaustion beyond its length remains a compatible terminal checkpoint', async () => {
  const f = fixture({ game: { scenes: { 'scene-a': [{ type: 'jump', next: 'scene-b#100' }], 'scene-b': [] } } });
  await f.engine.run();
  const saved = f.engine.createSaveState();
  assert.equal(saved.runtime.nodeIndex, 100); assert.equal(saved.ended, true);
  await f.engine.restoreSaveState(saved);
  assert.equal(f.engine.ended, true);
  f.engine.destroy();
});

test('stop during background restoration does not commit saved variables or progress', async () => {
  const f = fixture();
  let release, entered;
  const gate = new Promise(resolve => { entered = resolve; });
  f.ui.presentBackground = () => { entered(); return new Promise(resolve => { release = resolve; }); };
  const saved = f.engine.createSaveState(); saved.runtime.state.seen = true;
  const loading = f.engine.restoreSaveState(saved);
  await gate; f.engine.stop(); release();
  await assert.rejects(loading, error => error.code === 'busy');
  assert.equal(f.engine.state.seen, false);
  assert.throws(() => f.engine.createSaveState(), error => error.code === 'busy');
  f.engine.destroy();
});

test('catalog loads use catalog metadata overrides consistently with fresh starts', async () => {
  const f = fixture();
  await f.engine.save('manual-1');
  let metadata;
  f.ui.setScenarioMetadata = value => { metadata = value; };
  const catalog = new ScenarioCatalog([{ id: 'sample', title: 'Selected', chapter: 'ONE', entry: f.game }]);
  const playback = await catalog.loadScenario('manual-1', { saves: f.saves, stage: f.stage, ui: f.ui });
  assert.deepEqual(metadata, { id: 'sample', title: 'Selected', chapter: 'ONE' });
  playback.engine.stop(); await playback.finished;
  playback.engine.destroy();
});

for (const target of ['toString', '__proto__', 'constructor']) test(`runtime rejects inherited scene target ${target}`, async () => {
  const f = fixture({ game: { scenes: { 'scene-a': [{ type: 'jump', next: target }] } } });
  await assert.rejects(f.engine.run(), /Unknown jump target/);
  assert.equal(f.engine.ended, false);
  f.engine.destroy();
});
