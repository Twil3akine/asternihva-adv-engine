import { AdvEngine, DomUi, SpriteRenderer, calculateAutoDelay } from '../dist/index.js';

import { fitDialoguePage } from '../dist/ui/dialogue-paging.js';
import { demoUiConfig } from '../examples/asternihva/ui-config.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

/** Run after opening the example; tests need real layout, not a DOM mock. */
export async function testPresentation() {
  const game = document.querySelector('#game');
  for (let n = 0; n < 200 && game.dataset.mode !== 'line'; n++) await wait(50);
  const rect = game.getBoundingClientRect();
  assert(Math.abs(rect.width / rect.height - 16 / 9) < .001, 'Game aspect ratio');
  assert(rect.width <= innerWidth + 1 && rect.height <= innerHeight + 1, 'Game exceeds viewport');
  assert(document.documentElement.scrollHeight <= innerHeight + 1, 'Page scrolls');
  assert(document.querySelector('[data-debug-panel]').hidden === (game.dataset.debug !== 'true'), 'Debug visibility');
  assert(getComputedStyle(game).getPropertyValue('--adv-accent').trim() === '#efd477', 'Project theme');

  const fixture = document.createElement('section');
  fixture.className = 'adv-viewport';
  fixture.style.cssText = 'position:fixed;z-index:500;inset:0;margin:auto;background:#111827;';
  fixture.innerHTML = '<div class="adv-background"></div><div class="adv-character-layer"></div><section class="adv-dialogue"><div class="adv-speaker"></div><div class="adv-text"></div><span class="adv-page-indicator"></span></section><div class="adv-choices"></div>';
  document.body.append(fixture);
  const dialogue = fixture.querySelector('.adv-dialogue'), text = fixture.querySelector('.adv-text');
  const ui = new DomUi({ root: fixture, background: fixture.querySelector('.adv-background'), speaker: fixture.querySelector('.adv-speaker'), text, choices: fixture.querySelector('.adv-choices'), advanceTarget: dialogue, pageIndicator: fixture.querySelector('.adv-page-indicator') });
  let character, engine;
  try {
    assert(getComputedStyle(fixture).getPropertyValue('--adv-accent').trim() === '#9ebce8', 'Default theme leaked project colors');
    fixture.style.setProperty('--adv-text-color', 'rgb(128, 210, 220)');
    assert(getComputedStyle(text).color === 'rgb(128, 210, 220)', 'Custom theme override');
    fixture.style.removeProperty('--adv-text-color');
    assert(getComputedStyle(text).overflowY === 'hidden', 'Dialogue has a scrollbar');
    fixture.dataset.mode = 'line';
    const sample = '星が瞬いた。もう少し、ここで待とう。\n';
    const original = sample.repeat(80);
    const end = fitDialoguePage(original, 0, candidate => {
      text.textContent = candidate;
      return text.scrollHeight <= text.clientHeight + 1 && text.scrollWidth <= text.clientWidth + 1;
    });
    const onePage = original.slice(0, end);
    const lines = ['短い台詞です。', onePage.repeat(2), onePage.repeat(5) + '\n🙂最後の一行。'];
    let focused = 0;
    engine = new AdvEngine({ game: { start: 'start', characters: [], scenes: { start: [...lines.map(value => ({ type: 'line', speaker: 'a', text: value })), { type: 'end' }] } }, ui,
      stage: { setActive() { focused++; }, getName() { return 'Alice'; }, destroy() {} } });
    const run = engine.run();
    const counts = [];
    for (let line = 0; line < lines.length; line++) {
      await wait(0);
      const parts = [], focusCalls = focused;
      let page = 0;
      do {
        assert(text.scrollHeight <= text.clientHeight + 1, 'Page content overflows');
        parts.push(text.textContent);
        assert(focused === focusCalls, 'Page advanced scenario speaker/motion');
        page = Number(fixture.dataset.page);
        dialogue.click();
        await wait(0);
      } while (fixture.dataset.mode === 'line' && Number(fixture.dataset.page) > page && parts.length < 100);
      assert(parts.join('') === lines[line], 'Pagination lost or repeated text');
      counts.push(parts.length);
    }
    await run;
    assert(counts[0] === 1 && counts[1] === 2 && counts[2] >= 3, `Page counts ${counts}`);
    assert(engine.ended, 'Final page did not advance scenario');

    // Resize the text region while a line is pending; preserve the current offset.
    const pending = ui.presentLine({ text: original });
    fixture.style.width = `${rect.width * .72}px`;
    await wait(100);
    const resized = [];
    let previous;
    do {
      previous = Number(fixture.dataset.page);
      resized.push(text.textContent);
      assert(text.scrollHeight <= text.clientHeight + 1, 'Resized page overflows');
      dialogue.click(); await wait(0);
    } while (Number(fixture.dataset.page) > previous && resized.length < 100);
    await pending;
    assert(resized.join('') === original, 'Resize lost text');
    fixture.style.width = '';
    await wait(50);

    const choice = ui.presentChoice({ prompt: '選んでください。', options: Array.from({ length: 12 }, (_, index) => `選択肢 ${index + 1}`) });
    const buttons = [...fixture.querySelectorAll('.adv-choice')];
    const bounds = fixture.getBoundingClientRect();
    assert(buttons.every(button => { const r = button.getBoundingClientRect(); return r.top >= bounds.top && r.bottom <= bounds.bottom && r.left >= bounds.left && r.right <= bounds.right; }), 'Choices exceed game');
    buttons[11].click(); buttons[0].click();
    assert(await choice === 11, 'Choice selected twice or returned wrong index');

    ui.setActiveSpeaker("test");
    const host = fixture.querySelector('.adv-character-layer');
    const source = document.querySelector('#stage img').src;
    character = new SpriteRenderer({ crossfadeDuration: 100 }).create(host, { id: 'test', name: 'Test', renderer: 'sprite', assets: { expressions: { normal: source, alternate: `${source}?test` }, portrait: { scale: 1.5, anchorX: .5, anchorY: -.04 }, motions: { move: { keyframes: [{ translate: '0 0' }, { translate: '0 -4px' }, { translate: '0 0' }], duration: 150 } } } });
    await character.show();
    const root = host.firstElementChild;
    character.setActive(true);
    await wait(250);
    const before = root.getBoundingClientRect().toJSON();
    character.setActive(false);
    await wait(250);
    const after = root.getBoundingClientRect().toJSON();
    assert(['x','y','width','height'].every(key => before[key] === after[key]), 'Focus changes framing');
    assert(getComputedStyle(root).filter === 'brightness(0.55)' && Math.abs(Number(getComputedStyle(root).opacity) - .82) < .001, 'Unfocused character not dimmed');
    fixture.style.setProperty('--adv-unfocus-brightness', '.6');
    await wait(250);
    assert(getComputedStyle(root).filter === 'brightness(0.6)', 'Focus token override');
    fixture.style.removeProperty('--adv-unfocus-brightness');
    character.playMotion('move');
    assert(root.firstElementChild.getAnimations().length === 1, 'Motion missing');
    await character.setExpression('alternate');
    await wait(100);
    assert(root.querySelectorAll('img').length === 1, 'Crossfade outgoing image remained');
    character.setActive(true);
    await wait(250);
    assert(getComputedStyle(root).filter === 'brightness(1)' && getComputedStyle(root).opacity === '1', 'Active character not restored');
    ui.setActiveSpeaker(undefined);
    character.setActive(false);
    await wait(250);
    assert(getComputedStyle(root).filter === 'brightness(0.9)' && getComputedStyle(root).opacity === '1', 'Narration uniform focus');
    return { viewport: `${innerWidth}x${innerHeight}`, pages: counts, resize: true, themes: true, choices: 12, focus: true, motion: true, crossfade: true };
  } finally {
    character?.destroy(); engine?.destroy(); ui.destroy(); fixture.remove();
  }
}

export async function testDemoPlay() {
  const game = document.querySelector('#game');
  for (let n = 0; n < 200 && game.dataset.mode !== 'line'; n++) await wait(50);
  const dialogue = document.querySelector('#dialogue'), text = document.querySelector('#text');
  const height = dialogue.getBoundingClientRect().height;
  const expressions = new Map(['noah', 'seren', 'luminal'].map(id => [id, new Set()]));
  let longPages = 0, checkedLog = false, choices = false, steps = 0;
  const auto = document.querySelector('[data-control="auto"]');
  auto.click(); assert(auto.getAttribute('aria-pressed') === 'true', 'AUTO toggle');
  auto.click(); assert(auto.getAttribute('aria-pressed') === 'false', 'AUTO disable');
  document.querySelector('[data-control="menu"]').click();
  assert(document.querySelector('#menu-panel').open, 'MENU did not open');
  document.querySelector('#menu-panel').close();
  const skip = document.querySelector('[data-control="skip"]');
  const beforeSkip = text.textContent;
  skip.click(); await wait(200); skip.click();
  assert(skip.getAttribute('aria-pressed') === 'false' && text.textContent !== beforeSkip, 'SKIP did not advance or disable');
  while (game.dataset.mode !== 'ended' && steps++ < 100) {
    await wait(700);
    assert(dialogue.getBoundingClientRect().height === height, 'Dialogue height changed');
    if (game.dataset.mode === 'choice') {
      choices = true;
      document.querySelector('.adv-choice').click();
      await wait(250);
      continue;
    }
    assert(text.scrollHeight <= text.clientHeight + 1, 'Demo line overflows');
    const speaker = game.dataset.speaker;
    const roots = [...document.querySelectorAll('#stage .adv-sprite-character')];
    for (const root of roots) {
      const image = root.querySelector('img');
      assert(root.querySelectorAll('img').length === 1, 'Demo ghost remained');
      assert(image.complete && image.naturalWidth > 0, 'Demo image missing');
      expressions.get(root.dataset.character).add(image.src.split('/').pop());
      const style = getComputedStyle(root);
      const expected = speaker ? root.dataset.character === speaker ? 1 : .55 : .6;
      assert(Math.abs(Number(style.filter.match(/brightness\(([^)]+)\)/)[1]) - expected) < .001, `Demo focus: character=${root.dataset.character}, speaker=${speaker}, expected=${expected}, actual=${style.filter}`);
    }
    if (speaker === 'seren' && text.textContent.includes('あの光、覚えているわ')) {
      document.querySelector('[data-control="log"]').click();
      const panel = document.querySelector('#log-panel');
      assert(panel.open && panel.textContent.includes('今度は私ひとりの記憶にはならないから。'), 'Backlog did not preserve full node text');
      panel.close(); checkedLog = true;
    }
    if (Number(game.dataset.page) > 1) longPages++;
    dialogue.click(); await wait(50);
  }
  assert(game.dataset.mode === 'ended' && steps < 100, 'Demo did not end');
  assert(checkedLog && longPages >= 1 && choices, 'Missing long dialogue/log/choice');
  if (game.dataset.assets === 'local') assert([...expressions.values()].every(set => set.size >= 3), 'Missing expression variants');
  return { demo: true, steps, longPages, fullBacklog: checkedLog, choices, controls: true, expressionCounts: Object.fromEntries([...expressions].map(([id, set]) => [id, set.size])) };
}

export async function testPolish() {
  const root = document.querySelector('#game');
  const dialogue = document.querySelector('#dialogue');
  const text = document.querySelector('#text');
  const pageIndicator = document.querySelector('#page-indicator');
  const waitForLine = async () => {
    for (let n = 0; n < 200 && root.dataset.mode !== 'line'; n++) await wait(50);
    assert(root.dataset.mode === 'line', 'Demo did not enter dialogue');
  };
  const waitForPresentationChange = async (previousPage, previousText) => {
    for (let n = 0; n < 100; n++) {
      if (root.dataset.mode !== 'line' || Number(root.dataset.page) !== previousPage || text.textContent !== previousText) return;
      await wait(20);
    }
    throw new Error('Dialogue did not update after advancing');
  };
  const advanceNode = async () => {
    for (let n = 0; n < 100; n++) {
      const lastPage = pageIndicator.textContent.includes('▼');
      const pageBefore = Number(root.dataset.page);
      const textBefore = text.textContent;
      dialogue.click();
      await waitForPresentationChange(pageBefore, textBefore);
      if (root.dataset.mode !== 'line') return;
      if (lastPage) return;
    }
    throw new Error('Could not advance past current dialogue node');
  };

  await waitForLine();
  for (let n = 0; n < 30 && !text.textContent.includes('あの光、覚えているわ'); n++) {
    if (root.dataset.mode === 'choice') document.querySelector('.adv-choice').click();
    else await advanceNode();
    await wait(0);
  }
  assert(root.dataset.mode === 'line' && text.textContent.includes('あの光、覚えているわ'), 'Could not reach Seren’s long dialogue');
  await wait(250);

  const auto = document.querySelector('[data-control="auto"]');
  const targetPage = text.textContent;
  assert(document.querySelector('#controls').getBoundingClientRect().right + 4 <= pageIndicator.getBoundingClientRect().left, 'Page indicator overlaps dialogue controls');
  const originalSetTimeout = window.setTimeout;
  const delays = [];
  try {
    window.setTimeout = function (callback, delay, ...args) {
      delays.push(Number(delay));
      return originalSetTimeout.call(this, callback, delay, ...args);
    };
    auto.click();
  } finally {
    window.setTimeout = originalSetTimeout;
  }
  assert(auto.getAttribute('aria-pressed') === 'true', 'AUTO did not enable');
  const expectedDelay = calculateAutoDelay(targetPage, demoUiConfig.auto);
  assert(delays.includes(expectedDelay), `AUTO scheduled ${delays}; expected visible-page delay ${expectedDelay}`);
  auto.click();
  assert(auto.getAttribute('aria-pressed') === 'false', 'AUTO did not disable');

  document.querySelector('[data-control="log"]').click();
  const logPanel = document.querySelector('#log-panel');
  const content = logPanel.querySelector('.adv-log-content');
  assert(logPanel.open, 'LOG did not open');
  const articles = [...content.querySelectorAll('.adv-log-entry')];
  assert(articles.length > 0, 'LOG has no structured entries');
  assert(articles.every(article => article.getAttribute('role') === 'listitem'), 'LOG entries lack listitem roles');
  const narration = articles.find(article => article.classList.contains('adv-log-entry--narration'));
  assert(narration && !narration.querySelector('.adv-log-avatar'), 'LOG narration entry has an avatar or is missing');
  const latest = articles.at(-1);
  assert(latest.classList.contains('adv-log-entry--latest'), 'Latest LOG entry is not marked');
  assert(content.scrollTop + content.clientHeight >= content.scrollHeight - 2, 'LOG did not scroll to its latest entry');

  const longEntry = articles.find(article => article.querySelector('.adv-log-name')?.textContent === 'Seren' &&
    article.querySelector('.adv-log-text')?.textContent.includes('あの光、覚えているわ'));
  assert(longEntry, 'LOG did not retain Seren’s full dialogue entry');
  const fullText = longEntry.querySelector('.adv-log-text').textContent;
  assert(fullText.includes('今度は私ひとりの記憶にはならないから。') && fullText.includes('\n\n'), 'LOG lost the full multiline node text');
  assert(expectedDelay !== calculateAutoDelay(fullText, demoUiConfig.auto), 'AUTO timing did not depend on the current page');
  const stageImage = document.querySelector('#stage [data-character="seren"] img');
  const logImage = longEntry.querySelector('.adv-log-avatar img');
  assert(stageImage && logImage && logImage.src === stageImage.src, 'LOG portrait does not use Seren’s current expression');
  logPanel.close();

  const pages = [];
  for (let n = 0; n < 100; n++) {
    pages.push(text.textContent);
    if (pageIndicator.textContent.includes('▼')) break;
    dialogue.click();
    await wait(0);
  }
  assert(pages.length > 1 && pages.join('') === fullText, 'Paged dialogue differs from full LOG text');

  const menuButton = document.querySelector('[data-control="menu"]');
  const menuPanel = document.querySelector('#menu-panel');
  menuButton.click();
  assert(menuPanel.open, 'MENU did not open');
  const resume = menuPanel.querySelector('[data-menu-action="resume"]');
  const logAction = menuPanel.querySelector('[data-menu-action="log"]');
  const restart = menuPanel.querySelector('#restart');
  assert(resume && resume.textContent.trim() === 'Resume', 'MENU Resume action is missing');
  assert(logAction && logAction.textContent.trim() === 'Log', 'MENU Log action is missing');
  assert(restart && restart.textContent.trim() === 'Restart', 'MENU Restart action is missing');
  logAction.click();
  assert(!menuPanel.open && logPanel.open, 'MENU Log action did not switch to LOG');
  logPanel.close();
  menuButton.click();
  menuPanel.querySelector('[data-menu-action="resume"]').click();
  assert(!menuPanel.open, 'MENU Resume action did not close the menu');

  return { polish: true, logEntries: articles.length, narration: true, expressionPortrait: true, pages: pages.length, autoDelay: expectedDelay, menu: true };
}
