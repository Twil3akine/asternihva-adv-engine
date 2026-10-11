import { InputRouter, resolveKeyInput, type KeyBinding } from "../input.js";
export interface KeyboardInputOptions {
  target?: EventTarget;
  context?: () => string;
  bindings?: readonly KeyBinding[];
  shouldHandle?: (event: KeyboardEvent) => boolean;
}
/** Browser events stop at this boundary. Touch and gamepads can dispatch the same actions. */
export class BrowserKeyboardInput {
  readonly #target: EventTarget;
  readonly #handler: EventListener;
  constructor(router: InputRouter, options: KeyboardInputOptions = {}) {
    this.#target = options.target ?? window;
    this.#handler = event => {
      const key = event as KeyboardEvent;
      if (key.defaultPrevented || (options.shouldHandle ? !options.shouldHandle(key) : Boolean((key.target as Element | null)?.closest?.("input, textarea, select, [contenteditable], button, a, dialog")))) return;
      const action = resolveKeyInput({ key: key.key, ctrl: key.ctrlKey, alt: key.altKey, shift: key.shiftKey, meta: key.metaKey, repeat: key.repeat, composing: key.isComposing }, options.context?.(), options.bindings);
      if (action && router.dispatch(action)) key.preventDefault();
    };
    this.#target.addEventListener("keydown", this.#handler);
  }
  destroy(): void { this.#target.removeEventListener("keydown", this.#handler); }
}
