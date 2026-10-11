export type InputAction = "advance" | "confirm" | "cancel" | "menu" | "log" | "auto" | "skip" | "up" | "down" | "quickSave" | "quickLoad";
export interface PhysicalKeyInput { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean; repeat?: boolean; composing?: boolean; }
export interface KeyBinding { key: string; action: InputAction; context?: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean; allowRepeat?: boolean; }
export const DEFAULT_KEY_BINDINGS: readonly KeyBinding[] = Object.freeze(([
  ...["Enter", " ", "ArrowRight"].map(key => ({ key, action: "advance" as const, context: "line" })),
  ...["Enter", " "].map(key => ({ key, action: "confirm" as const, context: "choice" })),
  { key: "Escape", action: "cancel", context: "overlay" },
  { key: "Escape", action: "menu" }, { key: "ArrowUp", action: "up" }, { key: "ArrowDown", action: "down" },
  { key: "l", action: "log" }, { key: "a", action: "auto" }, { key: "s", action: "skip" },
  { key: "F5", action: "quickSave" }, { key: "F9", action: "quickLoad" },
] satisfies KeyBinding[]).map(binding => Object.freeze(binding)));
export function resolveKeyInput(input: PhysicalKeyInput, context = "line", bindings: readonly KeyBinding[] = DEFAULT_KEY_BINDINGS): InputAction | undefined {
  if (input.composing) return undefined;
  return bindings.find(binding => binding.key === input.key && (!binding.context || binding.context === context) &&
    ["ctrl", "alt", "shift", "meta"].every(key => Boolean(input[key as keyof PhysicalKeyInput]) === Boolean(binding[key as keyof KeyBinding])) &&
    (!input.repeat || binding.allowRepeat))?.action;
}
export type InputHandler = (action: InputAction) => boolean | void;
/** Host-independent action routing. Higher-priority/latest handlers may consume input. */
export class InputRouter {
  #listeners: { handler: InputHandler; priority: number }[] = [];
  subscribe(handler: InputHandler, priority = 0): () => void {
    const item = { handler, priority }; this.#listeners.push(item);
    return () => { this.#listeners = this.#listeners.filter(listener => listener !== item); };
  }
  dispatch(action: InputAction): boolean {
    for (const item of [...this.#listeners].reverse().sort((a,b) => b.priority-a.priority)) if (item.handler(action) === true) return true;
    return false;
  }
}
