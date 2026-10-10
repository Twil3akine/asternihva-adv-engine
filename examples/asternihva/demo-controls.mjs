import { DomUi, calculateAutoDelay } from "../../dist/index.js";

export class DemoUi extends DomUi {
  history = [];
  presentLine(line) {
    // Keep the original full node text; pagination never changes the backlog.
    this.history.push({ ...line });
    return super.presentLine(line);
  }
}

export function attachControls(root, ui, { auto = {} } = {}) {
  const controls = root.querySelector('#controls');
  let mode, timer;
  const stop = () => {
    clearTimeout(timer);
    mode = undefined;
    controls.querySelectorAll('[aria-pressed]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  };
  const schedule = () => {
    clearTimeout(timer);
    if (root.dataset.mode === 'ended') { stop(); return; }
    if (!mode || root.dataset.mode !== 'line' || root.querySelector('dialog[open]')) return;
    const delay = mode === 'skip' ? 150 : calculateAutoDelay(root.querySelector('#text').textContent, auto);
    timer = setTimeout(() => {
      if (mode && root.dataset.mode === 'line' && !root.querySelector('dialog[open]')) root.querySelector('#dialogue').click();
      // The next visible page/node reschedules through its DOM update.
    }, delay);
  };
  const stateObserver = new MutationObserver(schedule);
  stateObserver.observe(root, { attributes: true, attributeFilter: ['data-mode', 'data-page'] });
  const pageObserver = new MutationObserver(schedule);
  pageObserver.observe(root.querySelector('#text'), { childList: true, characterData: true, subtree: true });
  controls.addEventListener('click', event => {
    event.stopPropagation();
    const action = event.target.closest('button')?.dataset.control;
    if (!action) return;
    if (action === 'auto' || action === 'skip') {
      const previous = mode;
      stop();
      if (previous !== action) {
        mode = action;
        controls.querySelector(`[data-control="${action}"]`).setAttribute('aria-pressed', 'true');
        schedule();
      }
    } else {
      stop();
      const panel = root.querySelector(`#${action}-panel`);
      if (action === 'log') panel.querySelector('.adv-log-content').textContent = ui.history
        .map(line => `${line.speakerName ?? '—'}\n${line.text}`).join('\n\n');
      panel.showModal();
    }
  });
  root.querySelectorAll('dialog').forEach(panel => panel.addEventListener('keydown', event => event.stopPropagation()));
  root.querySelector('#restart').addEventListener('click', () => location.reload());
  window.addEventListener('pagehide', () => { stop(); stateObserver.disconnect(); pageObserver.disconnect(); }, { once: true });
}
