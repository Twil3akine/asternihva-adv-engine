/** Settings stay in presentation; the engine's scenario state is unaffected. */
export function attachSettings(root, settings, { ui, stage, onBack }) {
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
    panel.querySelectorAll('[data-audio-setting]').forEach(slider => {
      const volume = value.audio?.[slider.dataset.audioSetting] ?? 1;
      slider.value = String(volume);
      panel.querySelector(`[data-audio-value="${slider.dataset.audioSetting}"]`).textContent = `${Math.round(volume * 100)}%`;
    });
  };
  apply(settings.value);
  const unsubscribe = settings.subscribe(apply);
  opener.addEventListener('click', () => { menu.close(); panel.showModal(); });
  const back = () => { panel.close(); if (onBack) onBack(); else { menu.showModal(); opener.focus(); } };
  panel.querySelector('[data-settings-back]').addEventListener('click', back);
  panel.addEventListener('cancel', event => { event.preventDefault(); back(); });
  panel.addEventListener('click', event => {
    const button = event.target.closest('[data-setting]');
    if (!button) return;
    const value = button.dataset.value;
    settings.update({ [button.dataset.setting]: value === 'true' ? true : value === 'false' ? false : value });
  });
  panel.addEventListener('input', event => {
    const channel = event.target.dataset?.audioSetting;
    if (!['master', 'bgm', 'se', 'voice'].includes(channel)) return;
    settings.update({ audio: { master: 1, bgm: 1, se: 1, voice: 1, ...settings.value.audio, [channel]: Number(event.target.value) } });
  });
  const updateFullscreen = () => {
    const supported = document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function';
    fullscreen.disabled = !supported;
    fullscreen.textContent = document.fullscreenElement ? '全画面表示を終了' : '全画面表示にする';
    fullscreen.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
  };
  updateFullscreen();
  document.addEventListener('fullscreenchange', updateFullscreen);
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      fullscreen.removeAttribute('data-error');
    } catch {
      fullscreen.dataset.error = 'unavailable';
      fullscreen.textContent = '全画面表示を利用できません';
    }
  });
  window.addEventListener('pagehide', () => {
    unsubscribe(); document.removeEventListener('fullscreenchange', updateFullscreen);
  }, { once: true });
}
