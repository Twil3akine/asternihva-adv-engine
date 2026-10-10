import { DomUi, calculateAutoDelay } from "../../dist/index.js";

import { createLogEntry, renderLogEntries } from "./demo-log.mjs";

export class DemoUi extends DomUi {
  history = [];
  constructor(elements, { resolveIcon } = {}) {
    super(elements);
    this.resolveIcon = resolveIcon;
  }
  renderLog(container) { renderLogEntries(container, this.history, this.resolveIcon); }
  presentLine(line) {
    // Keep the original full node text; pagination never changes the backlog.
    this.history.push(createLogEntry(line));
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
      if (action === 'log') ui.renderLog(panel.querySelector('.adv-log-content'));
      panel.showModal();
      if (action === 'log') {
        const content = panel.querySelector('.adv-log-content');
        content.scrollTop = content.scrollHeight;
      }
    }
  });
  root.querySelectorAll('dialog').forEach(panel => panel.addEventListener('keydown', event => event.stopPropagation()));
  root.querySelector('[data-menu-action="log"]').addEventListener('click', () => {
    root.querySelector('#menu-panel').close();
    const panel = root.querySelector('#log-panel');
    const content = panel.querySelector('.adv-log-content');
    ui.renderLog(content);
    panel.showModal();
    content.scrollTop = content.scrollHeight;
  });
  root.querySelector('#restart').addEventListener('click', () => location.reload());
  window.addEventListener('pagehide', () => { stop(); stateObserver.disconnect(); pageObserver.disconnect(); }, { once: true });
}
