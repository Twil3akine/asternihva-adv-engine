export interface ViewportInsets { top?: number; right?: number; bottom?: number; left?: number; }
/** Fit a 16:9 surface inside the visible, safe rectangle without cropping. */
export function fitGameViewport(width: number, height: number, insets: ViewportInsets = {}): { width: number; height: number } {
  const values = [width, height, ...Object.values(insets)];
  if (values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new TypeError('Viewport dimensions must be finite and non-negative.');
  const availableWidth = Math.max(0, width - (insets.left ?? 0) - (insets.right ?? 0));
  const availableHeight = Math.max(0, height - (insets.top ?? 0) - (insets.bottom ?? 0));
  const fittedWidth = Math.min(availableWidth, availableHeight * 16 / 9);
  return { width: fittedWidth, height: fittedWidth * 9 / 16 };
}
export interface LandscapeViewportOptions {
  /** Container receives visual-viewport dimensions; defaults to the root's parent. */
  shell?: HTMLElement;
  message?: string;
  /** Stop host auto/skip modes here. This helper does not change runtime positions. */
  onOrientationChange?(portrait: boolean): void;
}
const visibleProperties = ['--adv-visible-width','--adv-visible-height','--adv-visible-left','--adv-visible-top'] as const;
/** Opt-in viewport/rotation overlay. Owns only its listeners, CSS properties and dialog. */
export class LandscapeViewport {
  readonly element: HTMLDialogElement;
  readonly #shell: HTMLElement;
  readonly #abort = new AbortController();
  readonly #previous = new Map<string, { value: string; priority: string }>();
  readonly #hadClass: boolean;
  readonly #oldOrientation?: string;
  readonly #oldInert: boolean;
  #portrait?: boolean;
  #opener?: HTMLElement;
  #destroyed = false;
  constructor(readonly root: HTMLElement, readonly options: LandscapeViewportOptions = {}) {
    this.#shell = options.shell ?? root.parentElement ?? root;
    if (this.#shell === root) throw new TypeError('A separate viewport shell is required.');
    this.#hadClass = this.#shell.classList.contains('adv-viewport-shell');
    this.#oldOrientation = root.dataset.orientation;
    this.#oldInert = root.inert;
    for (const property of visibleProperties) this.#remember(this.#shell, property);
    this.#remember(root, '--adv-fitted-width');
    this.#shell.classList.add('adv-viewport-shell');
    this.element = document.createElement('dialog');
    this.element.className = 'adv-orientation-overlay';
    this.element.textContent = options.message ?? '横向きでプレイしてください';
    this.element.setAttribute('aria-label', this.element.textContent);
    this.element.tabIndex = -1;
    document.body.append(this.element);
    this.element.addEventListener('cancel', event => event.preventDefault(), { signal: this.#abort.signal });
    window.addEventListener('keydown', event => {
      if (!this.#portrait) return;
      // Inert blocks DOM activation, but host window listeners still need a guard.
      event.stopImmediatePropagation();
      if (!event.ctrlKey && !event.metaKey && !event.altKey) event.preventDefault();
    }, { capture: true, signal: this.#abort.signal });
    window.addEventListener('resize', this.#update, { signal: this.#abort.signal });
    window.visualViewport?.addEventListener('resize', this.#update, { signal: this.#abort.signal });
    window.visualViewport?.addEventListener('scroll', this.#update, { signal: this.#abort.signal });
    this.#update();
  }
  #remember(element: HTMLElement, property: string): void {
    this.#previous.set(property, { value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) });
  }
  readonly #update = (): void => {
    if (this.#destroyed) return;
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
    const style = getComputedStyle(this.root);
    const insets = Object.fromEntries(['top','right','bottom','left'].map(side => [side, Math.max(0, parseFloat(style.getPropertyValue(`--adv-safe-${side}`)) || 0)]));
    const fitted = fitGameViewport(width, height, insets);
    for (const [property, value] of [
      ['--adv-visible-width', width], ['--adv-visible-height', height],
      ['--adv-visible-left', viewport?.offsetLeft ?? 0], ['--adv-visible-top', viewport?.offsetTop ?? 0],
    ] as const) this.#shell.style.setProperty(property, `${value}px`);
    this.root.style.setProperty('--adv-fitted-width', `${fitted.width}px`);
    // Layout orientation (not the reduced visual viewport from an on-screen keyboard).
    const portrait = window.innerHeight > window.innerWidth;
    this.root.dataset.orientation = portrait ? 'portrait' : 'landscape';
    if (portrait === this.#portrait) return;
    this.#portrait = portrait;
    if (portrait) {
      this.#opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
      this.root.inert = true;
      if (!this.element.open) this.element.showModal();
      this.element.focus();
    } else {
      this.root.inert = this.#oldInert;
      if (this.element.open) this.element.close();
      if (this.#opener?.isConnected) this.#opener.focus({ preventScroll: true });
    }
    this.options.onOrientationChange?.(portrait);
  };
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#abort.abort();
    if (this.element.open) this.element.close();
    this.element.remove();
    this.root.inert = this.#oldInert;
    if (this.#oldOrientation === undefined) delete this.root.dataset.orientation;
    else this.root.dataset.orientation = this.#oldOrientation;
    if (!this.#hadClass) this.#shell.classList.remove('adv-viewport-shell');
    for (const [property, { value, priority }] of this.#previous) {
      const element = property === '--adv-fitted-width' ? this.root : this.#shell;
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    }
  }
}
export const mobileLandscapeCss = `
:where(:root) {
  --adv-safe-top: env(safe-area-inset-top, 0px);
  --adv-safe-right: env(safe-area-inset-right, 0px);
  --adv-safe-bottom: env(safe-area-inset-bottom, 0px);
  --adv-safe-left: env(safe-area-inset-left, 0px);
}
.adv-viewport-shell {
  position: fixed; left: var(--adv-visible-left, 0px); top: var(--adv-visible-top, 0px);
  width: var(--adv-visible-width, 100vw); height: var(--adv-visible-height, 100dvh);
  min-height: 0; margin: 0; box-sizing: border-box; display: grid; place-items: center;
  padding: var(--adv-safe-top) var(--adv-safe-right) var(--adv-safe-bottom) var(--adv-safe-left);
}
.adv-viewport[data-orientation="portrait"] { visibility: hidden; }
.adv-orientation-overlay {
  position: fixed; inset: 0; margin: 0; width: 100%; height: 100%; max-width: none; max-height: none;
  box-sizing: border-box; border: 0; color: #f4f6fc; background: #18212e;
  padding: calc(24px + env(safe-area-inset-top)) calc(24px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(24px + env(safe-area-inset-left));
  font: 20px/1.6 system-ui, sans-serif;
}
.adv-orientation-overlay[open] { display: grid; place-items: center; }
@media (orientation: landscape) and (max-height: 540px) {
  .adv-viewport { --adv-text-size: 16px; --adv-text-line-height: 1.4; --adv-dialog-height: clamp(116px, 40%, 160px); --adv-dialog-padding-inline: 12px; --adv-dialog-padding-top: 26px; --adv-dialog-padding-bottom: 44px; }
  .adv-viewport button, .adv-panel button { min-height: 44px; min-width: 44px; touch-action: manipulation; }
  .adv-dialogue { bottom: 8px; }
  .adv-speaker { top: 4px; font-size: 14px; padding: 0; }
  .adv-page-indicator { font-size: 12px; bottom: 12px; left: 12px; right: auto; }
  .adv-controls { bottom: 0; right: 8px; gap: 4px; }
  .adv-control { font-size: 13px; padding: 4px 8px; }
  .adv-choices { bottom: calc(var(--adv-dialog-height) + 16px); width: 80%; left: 10%; max-height: calc(100% - var(--adv-dialog-height) - 24px); overflow: auto; grid-auto-rows: minmax(44px, auto); gap: 4px; }
  .adv-choice { font-size: 16px; padding: 8px 12px; }
  .adv-scenario-title { top: 6px; font-size: 12px; }
  .adv-panel { box-sizing: border-box; width: min(92vw, 760px); max-width: calc(var(--adv-visible-width, 100vw) - 2 * max(var(--adv-safe-left, 0px), var(--adv-safe-right, 0px)) - 16px); max-height: calc(var(--adv-visible-height, 100dvh) - 2 * max(var(--adv-safe-top, 0px), var(--adv-safe-bottom, 0px)) - 16px); padding: 12px; font-size: 16px; overflow: auto; }
  .adv-panel h2, .adv-panel h3, .adv-panel-header h2 { font-size: 18px; margin-block: 4px; }
  .adv-panel-header { padding: 4px; gap: 12px; }
  .adv-log-panel { height: auto; }
  .adv-log-content { max-height: calc(var(--adv-visible-height, 100dvh) - 100px); height: auto; }
  .adv-log-text { font-size: 16px; }
  .adv-log-panel .adv-panel-header button { font-size: 16px; }
  .adv-save-slots { max-block-size: none; }
  .adv-save-slot p { margin-block: 8px; }
  .adv-save-panel [role="status"] { margin-block: 4px; }
}
`;
