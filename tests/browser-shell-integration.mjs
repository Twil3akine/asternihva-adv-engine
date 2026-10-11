import assert from 'node:assert/strict';

/** Exercise the actual example shell with neutral scenarios and no artwork/font requests. */
export async function testShellIntegration(browser, origin) {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  page.setDefaultTimeout(8000);
  const bytes = Buffer.alloc(1644);
  bytes.write('RIFF',0); bytes.writeUInt32LE(1636,4); bytes.write('WAVE',8); bytes.write('fmt ',12);
  bytes.writeUInt32LE(16,16); bytes.writeUInt16LE(1,20); bytes.writeUInt16LE(1,22);
  bytes.writeUInt32LE(8000,24); bytes.writeUInt32LE(16000,28); bytes.writeUInt16LE(2,32); bytes.writeUInt16LE(16,34);
  bytes.write('data',36); bytes.writeUInt32LE(1600,40);
  const tone = 'data:audio/wav;base64,' + bytes.toString('base64');
  await page.addInitScript(() => {
    window.audioGains = []; window.closedAudioContexts = 0;
    const create = AudioContext.prototype.createGain, close = AudioContext.prototype.close;
    AudioContext.prototype.createGain = function() { const gain = create.call(this); window.audioGains.push(gain); return gain; };
    AudioContext.prototype.close = function() { window.closedAudioContexts++; return close.call(this); };
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/examples/generic/scenario.mjs', route => route.fulfill({ contentType: 'text/javascript', body: `
    export const characters=[], backgrounds={}, layouts={};
    export const scenarios=['sample-a','sample-b'].map(id => ({
      scenario: { id, title: id }, start: 'scene-a', characters: [], audioAssets: { tone: ${JSON.stringify(tone)} }, scenes: {
        'scene-a': [{ type: 'audio', channel: 'bgm', id: 'tone' }, { type: 'line', text: 'hello' }, { type: 'choice', options: [
          { text: 'A', next: 'scene-b', set: { route: 'a' } }, { text: 'B', next: 'scene-b', set: { route: 'b' } }
        ] }], 'scene-b': [{ type: 'line', text: 'done' }, { type: 'end' }]
      }
    }));
  ` }));
  try {
    await page.goto(`${origin}/examples/generic/index.html`);
    const root = page.locator('#game');
    await page.waitForFunction(() => document.querySelector('#game').dataset.shellReady === 'true');
    await page.locator('[data-shell-action="settings"]').click();
    await page.locator('[data-audio-setting="master"]').fill('0.45');
    assert.equal(await page.locator('[data-audio-value="master"]').textContent(), '45%');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#game').dataset.shellReady === 'true');
    await page.locator('[data-shell-action="settings"]').click();
    assert.equal(await page.locator('[data-audio-setting="master"]').inputValue(), '0.45');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#settings-panel').evaluate(dialog => dialog.open), false);
    await page.locator('[data-shell-action="start"]').click();
    await page.waitForFunction(() => document.querySelector('#game').dataset.mode === 'line');
    assert.equal(await page.evaluate(() => window.audioGains.at(-1).gain.value), Math.fround(0.45));
    await page.keyboard.press('F5');
    await page.waitForFunction(() => Object.keys(localStorage).some(key => key.includes('quicksave')));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('generic.saves:save:quicksave')).state.audio.bgm.id), 'tone');
    await page.keyboard.press('Escape');
    await page.locator('[data-save-action="save"]').click();
    await page.locator('.adv-save-panel [data-slot="manual-1"] button').first().click();
    await page.waitForFunction(() => document.querySelector('.adv-save-panel [role="status"]').textContent === '保存しました');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement === document.querySelector('#game'));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#game').dataset.mode === 'choice');
    await page.keyboard.press('Escape');
    await page.locator('[data-save-action="save"]').click();
    await page.locator('.adv-save-panel [data-slot="manual-2"] button').first().click();
    await page.waitForFunction(() => document.querySelector('.adv-save-panel [role="status"]').textContent === '保存しました');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#text').textContent === 'done');
    await page.keyboard.press('F9');
    await page.waitForFunction(() => document.querySelector('#text').textContent === 'hello');
    await page.keyboard.press('Escape');
    await page.locator('[data-shell-action="chapters-menu"]').click();
    await page.locator('[data-scenario-id="sample-b"]').click();
    await page.waitForFunction(() => document.querySelector('#game').dataset.mode === 'line');
    await page.keyboard.press('Escape');
    await page.locator('[data-shell-action="title-menu"]').click();
    await page.locator('[data-save-action="load"]').first().click();
    await page.locator('.adv-save-panel [data-slot="manual-2"] button').first().click();
    await page.waitForFunction(() => document.querySelector('#game').dataset.mode === 'choice' && !document.querySelector('.adv-save-panel').open);
    // The saved chapter was selected, the other chapter was not incorrectly cleared.
    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('generic.chapter-progress')));
    assert(!progress.completedIds.includes('sample-b'));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#text').textContent === 'done');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#game').dataset.mode === 'ended');
    assert.equal(await root.getAttribute('data-screen'), 'game');
    assert.equal(await page.locator('#end-title').textContent(), 'sample-a');
    assert(await page.evaluate(() => window.closedAudioContexts >= 2));
    assert.deepEqual(errors, []);
    return { shellSaveLoad: true, crossChapterLoad: true, choiceRestore: true, quickKeys: true, volumePersistence: true, stoppedProgress: true, shellAudio: true };
  } catch (error) {
    console.error(JSON.stringify({ shellCheckpoint: await page.evaluate(() => ({ mode: document.querySelector('#game')?.dataset.mode, focus: { tag: document.activeElement?.tagName, id: document.activeElement?.id, slot: document.activeElement?.parentElement?.dataset.slot }, dialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.id || dialog.className) })), errors }));
    throw error;
  } finally { await page.close(); }
}
