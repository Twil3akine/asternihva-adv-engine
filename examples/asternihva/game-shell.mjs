import { renderChapterSelect } from './chapter-select.mjs';

/** Navigation only. Scenario execution and game UI stay in their existing modules. */
export function attachGameShell(root, catalog, { onStart, onLeave, onSettings }) {
  const title = root.querySelector('#title-screen');
  const chapters = root.querySelector('#chapter-screen');
  let currentId;
  let starting = false;
  let generation = 0;
  const show = screen => {
    generation++;
    onLeave();
    root.dataset.screen = screen;
    root.dataset.mode = screen;
    title.hidden = screen !== 'title';
    chapters.hidden = screen !== 'chapter';
    if (screen === 'chapter') renderChapterSelect(root.querySelector('#chapter-list'), catalog, start, currentId).focus();
    else title.querySelector('button')?.focus();
  };
  const start = async id => {
    if (starting || !catalog.getScenarioMetadata(id)) return;
    starting = true;
    const token = ++generation;
    currentId = id;
    root.dataset.screen = 'game';
    root.dataset.mode = 'intro';
    title.hidden = chapters.hidden = true;
    document.activeElement?.blur();
    try {
      const playback = await onStart(id);
      starting = false;
      playback.finished.catch(error => {
        if (token === generation) {
          show('chapter');
          root.querySelector('#asset-status').hidden = false;
          root.querySelector('#asset-status').textContent = `シナリオを再生できませんでした: ${error.message}`;
        }
      });
    } catch (error) {
      starting = false;
      show('chapter');
      root.querySelector('#asset-status').hidden = false;
      root.querySelector('#asset-status').textContent = `シナリオを開始できませんでした: ${error.message}`;
    }
  };
  root.querySelector('[data-shell-action="start"]').disabled = !catalog.getScenarios().length;
  root.querySelector('[data-shell-action="start"]').addEventListener('click', () => start(catalog.getScenarios()[0].id));
  root.querySelector('[data-shell-action="chapter"]').addEventListener('click', () => show('chapter'));
  root.querySelector('[data-shell-action="title"]').addEventListener('click', () => show('title'));
  root.querySelector('[data-shell-action="settings"]').addEventListener('click', onSettings);
  root.querySelector('[data-end-chapters]').addEventListener('click', () => show('chapter'));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && root.dataset.screen === 'chapter') {
      event.preventDefault();
      show('title');
    }
  });
  show('title');
  root.dataset.shellReady = 'true';
  return { start, showTitle: () => show('title'), showChapters: () => show('chapter'), replay: () => start(currentId) };
}
