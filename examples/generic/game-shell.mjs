import { renderChapterSelect } from './chapter-select.mjs';

/** Navigation only. Scenario execution and game UI stay in their existing modules. */
export function attachGameShell(root, catalog, { onStart, onLeave, onSettings, progress, input }) {
  const title = root.querySelector('#title-screen');
  const chapters = root.querySelector('#chapter-screen');
  let currentId;
  let starting = false;
  let generation = 0;
  let pending;
  const leave = () => { pending?.abort(); pending = undefined; starting = false; onLeave(); };
  const show = screen => {
    generation++;
    leave();
    root.dataset.screen = screen;
    root.dataset.mode = screen;
    title.hidden = screen !== 'title';
    chapters.hidden = screen !== 'chapter';
    if (screen === 'chapter') renderChapterSelect(root.querySelector('#chapter-list'), catalog, start, currentId ?? progress?.snapshot().lastPlayedId, progress).focus();
    else title.querySelector('button')?.focus();
  };
  const start = async (id, saveState) => {
    if (starting || !catalog.getScenarioMetadata(id)) return false;
    leave();
    starting = true;
    const token = ++generation;
    pending = new AbortController();
    const signal = pending.signal;
    currentId = id;
    root.dataset.screen = 'game';
    root.dataset.mode = 'intro';
    title.hidden = chapters.hidden = true;
    document.activeElement?.blur();
    try {
      const playback = await onStart(id, { saveState, signal });
      if (token !== generation || signal.aborted) return false;
      progress?.markPlayed(id);
      playback.finished.then(() => {
        if (token === generation && (!playback.engine || playback.engine.ended)) progress?.markCompleted(id);
      }).catch(error => {
        if (token === generation) {
          show('chapter');
          root.querySelector('#asset-status').hidden = false;
          root.querySelector('#asset-status').textContent = `シナリオを再生できませんでした: ${error.message}`;
        }
      });
      return true;
    } catch (error) {
      if (token !== generation || signal.aborted) return false;
      show('chapter');
      root.querySelector('#asset-status').hidden = false;
      root.querySelector('#asset-status').textContent = `シナリオを開始できませんでした: ${error.message}`;
      if (saveState) throw error;
      return false;
    } finally {
      if (token === generation) starting = false;
    }
  };
  root.querySelector('[data-shell-action="start"]').disabled = !catalog.getScenarios().length;
  root.querySelector('[data-shell-action="start"]').addEventListener('click', () => start(catalog.getScenarios()[0].id));
  root.querySelector('[data-shell-action="chapter"]').addEventListener('click', () => show('chapter'));
  root.querySelector('[data-shell-action="title"]').addEventListener('click', () => show('title'));
  root.querySelector('[data-shell-action="settings"]').addEventListener('click', onSettings);
  root.querySelector('[data-end-chapters]').addEventListener('click', () => show('chapter'));
  root.querySelector('[data-shell-action="chapters-menu"]')?.addEventListener('click', () => show('chapter'));
  root.querySelector('[data-shell-action="title-menu"]')?.addEventListener('click', () => show('title'));
  const handleAction = action => {
    if ((action === 'cancel' || action === 'menu') && root.dataset.screen === 'chapter') { show('title'); return true; }
    return false;
  };
  const unsubscribe = input?.subscribe(handleAction, 20);
  if (!input) root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && root.dataset.screen === 'chapter') {
      event.preventDefault();
      show('title');
    }
  });
  globalThis.window?.addEventListener('pagehide', () => { generation++; leave(); unsubscribe?.(); }, { once: true });
  show('title');
  root.dataset.shellReady = 'true';
  return { start, restore: state => start(state.scenarioId, state), showTitle: () => show('title'), showChapters: () => show('chapter'), replay: () => start(currentId) };
}
