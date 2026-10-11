/** Generic real-DOM fixture; called by the Chromium smoke when this UI is installed. */
export async function testSaveLoadPanel(){
 const {SaveStore}=await import('/dist/core.js'),{SaveLoadPanel}=await import('/dist/web.js');
 const assert=(v,m)=>{if(!v)throw Error(m);};
 const state={version:1,scenarioId:'sample',runtime:{sceneId:'scene-a',nodeIndex:0,state:{}},presentation:{characters:[]},ended:false};
 const data=new Map(),saves=new SaveStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},'panel-fixture');
 const opener=document.createElement('button');opener.textContent='Open';document.body.append(opener);opener.focus();
 const panel=new SaveLoadPanel(document.body,{saves,onSave:s=>saves.save(s,state),onLoad:s=>saves.load(s)});
 const tick=()=>new Promise(r=>setTimeout(r,20));
 const until=async fn=>{for(let i=0;i<50;i++){if(fn())return;await tick();}throw Error('Save panel checkpoint timed out.');};
 try{
  await panel.open('save');assert(panel.element.querySelectorAll('.adv-save-slot').length===5,'Manual slots missing.');assert(panel.element.contains(document.activeElement),'Initial modal focus missing.');
  panel.element.querySelector('.adv-save-slot button').click();await until(()=>!panel.busy);assert(await saves.hasSave('manual-1'),'Manual save failed.');
  panel.close();assert(document.activeElement===opener,'Opener focus not restored.');await panel.open('load');panel.element.querySelector('[data-slot="manual-1"] button').click();await until(()=>!panel.element.open);assert(document.activeElement===opener,'Load close focus failed.');
  await panel.open('load');panel.element.dispatchEvent(new Event('cancel',{cancelable:true}));assert(!panel.element.open,'Cancel failed.');
  panel.handleAction('quickSave');await until(()=>!panel.busy);assert(await saves.hasSave('quicksave'),'Quick save hook failed.');
  return {savePanel:true,slots:true,focusReturn:true,cancel:true,quickSave:true};
 }finally{panel.destroy();opener.remove();}
}
