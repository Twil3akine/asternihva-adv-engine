# asternihva-adv-engine

A small TypeScript engine for data-driven visual novels and adventure games. The engine runs scenario nodes through UI and character-renderer interfaces; the included web adapters provide a DOM dialogue UI and image-based character sprites.

## Install

```sh
npm install asternihva-adv-engine
```

The package has no runtime dependencies. It uses ES modules and provides TypeScript declarations.

## Basic usage

```ts
import { AdvEngine, CharacterStage, type GameDefinition } from "asternihva-adv-engine/core";
import { DomUi, SpriteRenderer } from "asternihva-adv-engine/web";

const scenario: GameDefinition = {
  scenario: { id: "sample", chapter: "EP.00", title: "A Small Beginning" },
  start: "intro",
  characters: [{
    id: "alice",
    name: "Alice",
    renderer: "sprite",
    defaultExpression: "normal",
    assets: { expressions: { normal: "/assets/alice-normal.png" } },
  }],
  scenes: {
    intro: [
      { type: "line", speaker: "alice", text: "Hello." },
      { type: "choice", options: [
        { text: "Continue", next: "end" },
        { text: "Leave", next: "end" },
      ] },
    ],
    end: [{ type: "end" }],
  },
};

const host = document.querySelector<HTMLElement>("#game");
if (!host) throw new Error("Missing #game element");

const stage = new CharacterStage(host, scenario.characters, [new SpriteRenderer()]);
const ui = new DomUi({
  root: host,
  background: host,
  speaker: host.querySelector<HTMLElement>("[data-speaker]")!,
  text: host.querySelector<HTMLElement>("[data-text]")!,
  choices: host.querySelector<HTMLElement>("[data-choices]")!,
});
await new AdvEngine({ game: scenario, stage, ui }).run();
```

`DomUi` expects the required elements in `DomUiElements` to be provided by the host page. The web adapters export CSS strings for applications that want to use the built-in presentation styles.

## Scenarios and renderers

A scenario is a `GameDefinition`: a `start` scene, character definitions, and a map of scenes containing line, choice, jump, state, background, and end nodes. Character definitions name a renderer key and provide renderer-specific assets. Scenario catalogs can register multiple definitions with metadata and start one by ID.

`SpriteRenderer` is the built-in browser renderer. Implement `CharacterRenderer` and `RenderedCharacter` to connect a different renderer. The `live2d` subpath provides an SDK-independent adapter seam; applications provide their own model adapter and Cubism SDK integration.

```ts
import type { CharacterRenderer, CharacterDefinition, RenderedCharacter } from "asternihva-adv-engine/core";

class CustomRenderer implements CharacterRenderer<HTMLElement> {
  readonly key = "custom";
  create(host: HTMLElement, character: CharacterDefinition): RenderedCharacter {
    // Attach the application's own character view to host.
    return {
      show() {}, hide() {}, setExpression() {}, playMotion() {},
      setPosition() {}, destroy() {},
    };
  }
}
```

## Package exports

- `asternihva-adv-engine`: compatibility entry point with the main public API
- `asternihva-adv-engine/core`: engine, scenario catalog, stage contracts, and data types
- `asternihva-adv-engine/web`: DOM UI, sprite renderer, and browser helpers
- `asternihva-adv-engine/live2d`: SDK-independent Live2D adapter
- `asternihva-adv-engine/tooling`: scenario validation utilities

The `core` entry can be imported in Node.js without browser globals. Browser renderers and UI require a DOM when instantiated. `ChapterProgressStore` in `/web` stores played/completed chapter IDs and the last played ID through an injected storage adapter; it does not save node positions.

## Scenario catalog and validation

`ScenarioCatalog` accepts entries with an `id` and `entry` (the scenario definition). Metadata falls back to `entry.scenario`; optional `order` sorts before the chapter label. `getScenarios()`, `getScenario(id)`, `startScenario(id, { stage, ui })`, and `getCurrentScenario()` expose listing, lookup, playback, and the last started scenario. Missing lookups return `undefined`; invalid starts and duplicate IDs throw before playback.

```ts
import { validateScenarios } from "asternihva-adv-engine/tooling";
const result = validateScenarios([{ id: "sample", entry: scenario }]);
// result.errors, result.warnings, result.diagnostics, result.valid
```

The validator checks scene targets, graph reachability, and character/presentation registries. Register expressions and motions in character assets and backgrounds/layouts on the definition. Scene exhaustion is a valid end, matching the runner. Custom adapters can provide registry entries without loading their actual assets.

## Development

```sh
npm install
npm run typecheck
npm run build
npm test
npm run validate:scenarios
```

The local game shell loads private definitions from the ignored `scenario/` directory. They are not included in Git or npm distribution. `validate:scenarios` checks these local definitions and requires them to be present. Public development and tests use generic fixtures instead. Git history predating this separation still contains story text; history needs a separate publication decision before the repository is made public.

`npm run pack:smoke` packs and installs in a temporary directory, verifies all public imports, checks the core declarations without DOM libs, and rejects local story/assets. It never publishes.

## License

MIT. See [LICENSE](./LICENSE).

## Input actions

`InputRouter` in `/core` accepts `advance`, `confirm`, `cancel`, `menu`, `log`,
`auto`, `skip`, `up`, `down`, `quickSave` and `quickLoad`. Subscribe handlers that
return `true` to consume an action; higher-priority handlers run first.
Touch buttons and future gamepad adapters can call `dispatch` directly.
`resolveKeyInput` maps physical keys without DOM dependencies.

`BrowserKeyboardInput` in `/web` translates browser key events. Defaults use
Enter/Space/ArrowRight for line advance, Enter/Space to confirm choices,
ArrowUp/ArrowDown for choice navigation, Escape for menu/cancel, L/A/S for
log/auto/skip, F5/F9 for quick save/load. Only handled actions prevent the browser
default; composition, repeat and modifier combinations are ignored unless mapped.
Editable elements and native controls keep their keys.

`DomUi` accepts `{ input, keyboard, bindings }` and exposes `.input`; it handles
line/choice actions. The application subscribes menu/log/auto/skip/save/load
handlers on the same router. Set `keyboard: false` when the host owns keyboard
listeners. Custom bindings replace the default list. Overlay handlers should use
a higher priority and consume actions while open.
## Save and load

```ts
import { SaveStore } from "asternihva-adv-engine/core";
import { LocalStorageAdapter } from "asternihva-adv-engine/web";
const saves = new SaveStore(new LocalStorageAdapter(), "my-game");
const engine = new AdvEngine({ game: scenario, stage, ui, saves, autosave: true });
const finished = engine.run();
await engine.save("quicksave");
await engine.load("quicksave"); // stops old playback and reconstructs presentation
const resumed = engine.run();
```

Give each scenario a stable `scenario.id`. Slots are `autosave`, `quicksave`, and
`manual-1` through `manual-5`; custom slots can be passed to `SaveStore`.
`save`, `load`, `deleteSave`, `hasSave`, and `listSaves` are available on the store
and the configured engine. Schema v1 stores node position, scalar variables,
background/layout IDs, visibility, expressions and positions; it excludes DOM,
image caches, motion timing, dialogue text and assets. A waiting line or choice
resumes from its node (and a long line starts again at page one).

Saving during renderer transitions throws `SaveError` with code `busy`. Loading
validates first, cancels old input and waits for renderer work before restoration.
Call `run()` after loading. Implement `UiAdapter.cancelPending()` in custom UIs to
remove stale event handlers. Failed storage operations use code `storage`;
missing/corrupt/unsupported slots have distinct codes. `listSaves` omits invalid
slots, while `load(slot)` reports their error.

Autosave is opt-in and runs after scene nodes and resolved choices. An optional
`onAutosaveError` handles storage failures without stopping playback. Inject a
`progress` store with `markPlayed` / `markCompleted` to preserve chapter history;
loading never erases completion records. `catalog.loadScenario(slot, { saves,
stage, ui })` resolves a saved scenario before starting playback; the caller
must dispose of old playback and supply a stage matching that scenario. A save
for an unavailable scenario reports `scenario-missing`. Scenario revisions that
change scene/node IDs need an application migration policy.
