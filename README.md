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

The local game shell loads private definitions from the ignored `scenario/` directory. They are not included in Git or npm distribution. `validate:scenarios` checks these local definitions and requires them to be present. Public development and tests use generic fixtures instead. The package allowlist excludes the demo and local story directory. Check package contents before distributing a build.

`npm run pack:smoke` packs and installs in a temporary directory, verifies all public imports, checks the core declarations without DOM libs, and rejects local story/assets. It never publishes.

## License

MIT. See [LICENSE](./LICENSE).

## Verification and CI

`npm run verify:core` checks transitive core source imports/types for DOM leakage.
`npm run validate:fixture` validates a generic story without local assets.
`npm run pack:smoke` also rejects unpublished deep imports and compiles a consumer
with ES-only libs and no ambient types. Set `ADV_PRIVATE_SCENARIO_DIR` to an
external local directory to scan packed text for those story strings/fragments;
only file paths and counts are reported.

`npm run browser:test` runs a generic Chromium fixture without local artwork,
fonts or stories. Install Chromium with `npx playwright install chromium`.
`CHROMIUM_EXECUTABLE_PATH` optionally selects an existing binary. CI covers
Node 18/22/24 checks, package smoke, generic validation, Chromium and a Bun
runtime smoke. `npm run smoke:runtime` can also be run with Bun directly.

Unchecked playback limits consecutive automatic nodes to 10,000 by default;
`AdvEngineOptions.maxAutomaticSteps` can set a positive integer limit. A line or
choice resets the counter. This prevents a malformed deterministic loop from
starving the host. Stage construction rejects duplicate character/renderer IDs
before creating any renderer instances. Destroyed sprites ignore further work.
