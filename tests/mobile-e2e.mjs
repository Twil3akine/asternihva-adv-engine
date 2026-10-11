import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { serveFixture } from './http-fixture.mjs';
const server=await serveFixture('.'); let browser;
async function play(name,options,safe={}) {
  const context=await browser.newContext({...options,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const act=async locator=>options.hasTouch ? locator.tap() : locator.click();
  try {
    await page.goto(`${server.origin}/examples/generic/index.html`);
    await page.waitForFunction(()=>document.querySelector('#game').dataset.shellReady==='true');
    await page.evaluate(insets=>{for(const [side,value] of Object.entries(insets))document.documentElement.style.setProperty(`--adv-safe-${side}`,value+'px');window.dispatchEvent(new Event('resize'));},safe);
    async function contained(selector,{touch=false}={}) {
      const result=await page.locator(selector).first().evaluate((node,{safe,touch})=>{
        const r=node.getBoundingClientRect(); return {safe:r.x>= (safe.left??0)-1 && r.right<=innerWidth-(safe.right??0)+1 && r.y>= (safe.top??0)-1 && r.bottom<=innerHeight-(safe.bottom??0)+1,touch:!touch||(r.width>=43&&r.height>=43),x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,innerWidth,innerHeight,visualHeight:visualViewport.height};
      },{safe,touch});assert(result.safe,`${name}: ${selector} outside safe viewport (${JSON.stringify(result)})`);assert(result.touch,`${name}: ${selector} too small`);
    }
    await contained('#game');
    const box=await page.locator('#game').boundingBox();assert(Math.abs(box.width/box.height-16/9)<.01);
    await act(page.locator('[data-shell-action="chapter"]'));await contained('#chapter-screen');
    await act(page.locator('[data-shell-action="title"]'));await act(page.locator('[data-shell-action="settings"]'));await contained('#settings-panel');
    await act(page.locator('[data-settings-back]'));await act(page.locator('[data-shell-action="start"]'));
    await page.waitForFunction(()=>document.querySelector('#game').dataset.mode==='line'||!document.querySelector('#asset-status').hidden);
    assert.equal(await page.locator('#text').textContent(),'Hello.'); assert.equal(await page.locator('.adv-sprite-character[data-visible="true"]').count(),2);
    await page.waitForFunction(()=>[...document.querySelectorAll('#stage img')].every(img=>img.naturalWidth>0));
    assert.equal(await page.locator('#asset-status').isVisible(),false); await contained('#dialogue');
    if(process.env.ADV_SCREENSHOT_DIR){await mkdir(process.env.ADV_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.ADV_SCREENSHOT_DIR,name+'-dialogue.png')});}
    for(const action of ['menu','log','auto','skip'])await contained(`[data-control="${action}"]`,{touch:Boolean(options.hasTouch)});
    await act(page.locator('[data-control="log"]'));await contained('#log-panel');assert((await page.locator('.adv-log-text').textContent()).includes('Hello.'));
    assert.equal(await page.locator('.adv-log-text').evaluate(n=>getComputedStyle(n).userSelect),'text');await act(page.locator('#log-panel header button'));
    await act(page.locator('[data-control="menu"]'));await contained('#menu-panel');await act(page.locator('[data-menu-action="settings"]'));await contained('#settings-panel');
    await page.locator('[data-audio-setting="master"]').fill('0.4');await act(page.locator('[data-settings-back]'));await act(page.locator('[data-save-action="save"]'));
    await contained('.adv-save-panel');await act(page.locator('[data-slot="manual-1"] button').first());await page.waitForFunction(()=>document.querySelector('.adv-save-panel [role="status"]').textContent==='保存しました');await act(page.locator('.adv-save-panel header button'));
    await act(page.locator('#text'));await page.waitForFunction(()=>document.querySelector('#speaker').textContent==='Bob');await act(page.locator('#text'));await page.waitForFunction(()=>document.querySelector('#game').dataset.mode==='choice');
    await contained('.adv-choice',{touch:Boolean(options.hasTouch)});
    await act(page.locator('[data-control="menu"]'));await act(page.locator('[data-save-action="save"]'));await act(page.locator('[data-slot="manual-2"] button').first());await page.waitForFunction(()=>document.querySelector('.adv-save-panel [role="status"]').textContent==='保存しました');await act(page.locator('.adv-save-panel header button'));
    await act(page.locator('.adv-choice').nth(1));await page.waitForFunction(()=>document.querySelector('#text').textContent==='Done.');await page.waitForFunction(()=>document.querySelector('[data-character="alice"] img').src.endsWith('/alice-smile.svg'));
    await act(page.locator('[data-control="menu"]'));await act(page.locator('[data-save-action="load"]').last());await act(page.locator('[data-slot="manual-1"] button').first());await page.waitForFunction(()=>!document.querySelector('.adv-save-panel').open&&document.querySelector('#text').textContent==='Hello.');
    await act(page.locator('[data-control="auto"]'));await page.setViewportSize({width:options.viewport.height,height:options.viewport.width});await page.waitForFunction(()=>document.querySelector('.adv-orientation-overlay').open);
    await page.keyboard.press('Escape');await page.keyboard.press('Enter');assert.equal(await page.locator('dialog[open]').count(),1);
    assert(await page.locator('#game').evaluate(n=>n.inert));assert.equal(await page.locator('[data-control="auto"]').getAttribute('aria-pressed'),'false');
    await page.setViewportSize(options.viewport);await page.waitForFunction(()=>!document.querySelector('.adv-orientation-overlay').open);assert(!await page.locator('#game').evaluate(n=>n.inert));
    await act(page.locator('[data-control="menu"]'));await act(page.locator('[data-save-action="load"]').last());await act(page.locator('[data-slot="manual-2"] button').first());await page.waitForFunction(()=>!document.querySelector('.adv-save-panel').open&&document.querySelector('#game').dataset.mode==='choice');
    await act(page.locator('.adv-choice').nth(1));await page.waitForFunction(()=>document.querySelector('#text').textContent==='Done.');await act(page.locator('#text'));await page.waitForFunction(()=>document.querySelector('#game').dataset.mode==='ended');await contained('#end-card');
    if(process.env.ADV_SCREENSHOT_DIR){await mkdir(process.env.ADV_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.ADV_SCREENSHOT_DIR,name+'-end.png')});}
    await act(page.locator('[data-end-chapters]'));assert(await page.locator('#chapter-screen').isVisible());assert.deepEqual(errors,[]);
    // Dialog remains accessible in a shorter visual viewport; all actions can scroll into view.
    await page.setViewportSize({width:options.viewport.width,height:280});await act(page.locator('[data-shell-action="title"]'));await act(page.locator('[data-shell-action="settings"]'));await contained('#settings-panel');await act(page.locator('[data-settings-back]'));
    console.log(JSON.stringify({device:name,landscape:true,safeArea:true,touch:Boolean(options.hasTouch),portraitOverlay:true,title:true,chapterSelect:true,dialogue:true,choice:true,log:true,menu:true,settings:true,saveLoad:true,end:true,shortViewport:true}));
  } catch(error) { console.error(JSON.stringify({device:name,errors,checkpoint:await page.evaluate(()=>({mode:document.querySelector('#game')?.dataset.mode,status:document.querySelector('#asset-status')?.textContent,dialogs:[...document.querySelectorAll('dialog[open]')].map(n=>n.id||n.className)}))}));throw error; }
  finally{await context.close();}
}
try {
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
  await play('desktop',{viewport:{width:1280,height:720},hasTouch:false});
  await play('iphone-landscape',{...devices['iPhone 13 landscape']},{left:44,right:0,bottom:21});
  await play('android-landscape',{...devices['Pixel 5'],viewport:{width:851,height:393}},{left:0,right:0,bottom:16});
} finally { await browser?.close();await server.close(); }
