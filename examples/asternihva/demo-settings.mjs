/** Settings stay in presentation; the engine's scenario state is unaffected. */
export function attachSettings(root, settings, { ui, stage }) {
  const panel = root.querySelector('#settings-panel');
  const menu = root.querySelector('#menu-panel');
  const opener = menu.querySelector('[data-menu-action="settings"]');
  const fullscreen = panel.querySelector('#fullscreen');
  const apply = value => {
    ui.setAnimationsEnabled(value.uiAnimation);
    stage.setMotionEnabled(value.characterMotion);
    panel.querySelectorAll('[data-setting]').forEach(button => {
      button.setAttribute('aria-pressed', String(String(value[button.dataset.setting]) === button.dataset.value));
    });
  };
  apply(settings.value);
  const unsubscribe = settings.subscribe(apply);
  opener.addEventListener('click', () => { menu.close(); panel.showModal(); });
  const back = () => { panel.close(); menu.showModal(); opener.focus(); };
  panel.querySelector('[data-settings-back]').addEventListener('click', back);
  panel.addEventListener('cancel', event => { event.preventDefault(); back(); });
  panel.addEventListener('click', event => {
    const button = event.target.closest('[data-setting]');
    if (!button) return;
    const value = button.dataset.value;
    settings.update({ [button.dataset.setting]: value === 'true' ? true : value === 'false' ? false : value });
  });
  const updateFullscreen = () => {
    const supported = document.fullscreenEnabled && typeof root.requestFullscreen === 'function';
    fullscreen.disabled = !supported;
    fullscreen.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Enter Fullscreen';
    fullscreen.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
  };
  updateFullscreen();
  document.addEventListener('fullscreenchange', updateFullscreen);
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
      fullscreen.removeAttribute('data-error');
    } catch {
      fullscreen.dataset.error = 'unavailable';
      fullscreen.textContent = 'Fullscreen unavailable';
    }
  });
  window.addEventListener('pagehide', () => {
    unsubscribe(); document.removeEventListener('fullscreenchange', updateFullscreen);
  }, { once: true });
}
