import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('.');
const server=createServer(async(req,res)=>{
  const path=resolve(root,'.'+new URL(req.url,'http://local').pathname);
  if(path!==root&&!path.startsWith(root+sep)){res.statusCode=403;res.end();return;}
  if(path===root){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body></body></html>');return;}
  try{res.setHeader('Content-Type',['.js','.mjs'].includes(extname(path))?'text/javascript':'text/plain');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const result=await page.evaluate(async()=>{
  const core=await import('/dist/core.js'),web=await import('/dist/web.js');
  document.body.innerHTML='<main id="game"><div id="bg"></div><b id="speaker"></b><p id="text"></p><div id="choices"></div></main>';
  const root=document.querySelector('#game');root.style.setProperty('--adv-choice-duration','0ms');
  const elements={root,background:document.querySelector('#bg'),speaker:document.querySelector('#speaker'),text:document.querySelector('#text'),choices:document.querySelector('#choices')};
  const ui=new web.DomUi(elements),stage=new core.CharacterStage(root,[],[]);
  const game={scenario:{id:'sample'},start:'scene-a',characters:[],scenes:{'scene-a':[{type:'line',text:'hello'},{type:'choice',options:[{text:'A',next:'scene-b',set:{route:'a'}},{text:'B',next:'scene-b',set:{route:'b'}}]}],'scene-b':[{type:'line',text:'done'},{type:'end'}]}};
  const saves=core.SaveStore?new core.SaveStore(new web.LocalStorageAdapter(),'generic-browser'):undefined;
  const engine=new core.AdvEngine({game,stage,ui,saves,autosave:Boolean(saves)});
  const tick=()=>new Promise(r=>setTimeout(r,20));
  const until=async fn=>{for(let i=0;i<100;i++){if(fn())return;await tick();}throw Error('Browser checkpoint timed out.');};
  const key=(k,props={})=>window.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true,...props}));
  let run=engine.run();await until(()=>root.dataset.mode==='line');
  if(core.InputRouter){key('Enter',{repeat:true});await tick();if(elements.text.textContent!=='hello')throw Error('Repeated key advanced line.');}
  if(saves)await engine.save('quicksave');key('Enter');await until(()=>root.dataset.mode==='choice');
  if(saves)await engine.save('manual-1');
  if(core.InputRouter){key('ArrowDown');key('Enter');}else elements.choices.querySelectorAll('button')[1].click();
  await until(()=>engine.state.route==='b');await until(()=>elements.text.textContent==='done');
  if(saves){
   await engine.load('manual-1');await run;run=engine.run();await until(()=>root.dataset.mode==='choice');
   await engine.load('quicksave');await run;run=engine.run();await until(()=>root.dataset.mode==='line');if(elements.text.textContent!=='hello')throw Error('Saved line was not reconstructed.');
   key('Enter');await until(()=>root.dataset.mode==='choice');elements.choices.querySelector('button').click();await until(()=>elements.text.textContent==='done');
  }
  key('Enter');await run;if(!engine.ended)throw Error('Engine completion failed.');engine.destroy();
  const image=(color)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="${color}"/></svg>`);
  const cache=new web.DecodedImageCache(),renderer=new web.SpriteRenderer({imageCache:cache,crossfadeDuration:0});
  const character=renderer.create(root,{id:'alice',name:'Alice',renderer:'sprite',assets:{expressions:{normal:image('red'),smile:image('blue'),broken:'/missing.png'}}});
  await character.show();await character.setExpression('smile');const current=root.querySelector('.adv-sprite-character img').src;
  await character.setExpression('broken');if(root.querySelector('.adv-sprite-character img').src!==current)throw Error('Failed image replaced the current sprite.');
  character.destroy();const misses=cache.stats.misses;await character.setExpression('normal');if(cache.stats.misses!==misses||cache.stats.pinnedImages!==0)throw Error('Destroyed sprite retained image leases.');
  const settings=new web.GameSettingsStore({getItem:()=>'{broken',setItem(){}});if(settings.value.autoSpeed!=='normal')throw Error('Malformed settings failed to fall back.');
  const progress=new web.ChapterProgressStore({getItem:()=>'{broken',setItem(){}});if(progress.getStatus('sample')!=='NEW')throw Error('Malformed progress failed to fall back.');
  let audio=false;
  if(core.AudioController){
   function wav(){const bytes=new ArrayBuffer(1644),v=new DataView(bytes);const write=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));write(0,'RIFF');v.setUint32(4,1636,true);write(8,'WAVE');write(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);write(36,'data');v.setUint32(40,1600,true);return bytes;}
   const context=new AudioContext(),adapter=new web.BrowserAudioAdapter({assets:{a:'a.wav',b:'b.wav'},createContext:()=>context,load:async()=>wav()});await adapter.unlock();const controller=new core.AudioController(adapter);
   await controller.play('bgm','a',{fadeInMs:10});await Promise.all([controller.play('se','a'),controller.play('se','a')]);await controller.play('voice','a');await controller.lineChanged();await controller.play('bgm','b',{crossfadeMs:20});const state=controller.snapshot();if(state.bgm.id!=='b')throw Error('BGM state mismatch.');await controller.restore(state);controller.destroy();await tick();if(context.state!=='closed')throw Error('Audio context did not close.');audio=true;
  }
  const panel=web.SaveLoadPanel?await (await import('/tests/browser-save-panel.mjs')).testSaveLoadPanel():undefined;
  return {chromium:true,savePanel:Boolean(panel),lineChoice:true,input:Boolean(core.InputRouter),saveLoad:Boolean(saves),audio,imageFailure:true,destroyRace:true,malformedStorage:true,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
 });
 assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
