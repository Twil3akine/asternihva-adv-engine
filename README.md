# asternihva-adv-engine

asternihva-adv-engine is a general-purpose ADV / visual novel engine originally developed for the Asternihva Project. The engine runs scenario nodes through UI and character-renderer interfaces; the included web adapters provide a DOM dialogue UI and image-based character sprites.

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
  scenario: { id: "sample", chapter: "CH.1", title: "Sample" },
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
      { type: "scene", commands: [{ character: "alice", show: true, position: "center" }] },
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
npm run validate:fixture
```

`examples/generic/` is a standalone public sample with Alice and Bob, geometric
SVG sprites, a background, two chapters, expression changes, choices, title,
log, settings, Save/Load and End. Run `npm run build`, `npm run serve:example`,
then open `/examples/generic/`. It needs no external game repository, local fonts
or private data. Sample shell modules are application code, not package APIs.

`npm run verify:boundary` scans tracked source and the pack smoke also scans
installed package contents. Reserved work-detail fingerprints and private path
checks prevent game-specific code or data returning to the public tree. Optional
external private-text scanning is read-only and reports paths/counts only.
The check covers the current tree, not historical commits. Removing previously
tracked data does not remove it from Git history.

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
## Asset tooling

Install the optional image converter with `npm install sharp` and run:

```sh
asternihva-adv-engine asset build assets.json public/generated
# From a checkout:
npm run assets -- assets.json public/generated
```

Manifest paths resolve relative to the JSON file:

```json
{
  "version": 1,
  "assets": [{
    "id": "alice", "source": "source.png", "format": "webp",
    "maxWidth": 1600, "maxHeight": 1600,
    "thumbnail": { "size": 192, "format": "png" }
  }]
}
```

PNG and WebP retain alpha, resize inside bounds without enlarging, and emit
content-hashed files plus `assets.generated.json`. Thumbnail generation retains
aspect ratio without cropping. Source/config/converter fingerprints skip unchanged
assets; output hashes also detect missing or corrupt generated files. Stale
hashed files are reported and retained for review. IDs must use letters, digits,
underscores or hyphens. No source images are included in the package.

`buildAssets`, `validateAssetManifest`, and their types are available from
`/tooling`. Inject an `ImageTransformer` with a stable version string for other
converters; only the CLI needs Sharp. `/tooling` uses Node filesystem APIs.

## Scenario analysis CLI

```sh
asternihva-adv-engine scenario validate ./sample.mjs
asternihva-adv-engine scenario validate ./sample.mjs --lint
asternihva-adv-engine scenario stats ./sample.mjs
asternihva-adv-engine scenario graph ./sample.mjs ./graph.json
asternihva-adv-engine scenario graph ./sample.mjs ./graph.dot
```

Modules export a definition, catalog entry, array, or `scenarios` list. They are
trusted executable JavaScript, not sandboxed input. Supply the full character,
background and layout registries when validating references. CLI output contains
only IDs, pass/fail, counts and statistics; failures do not quote module source.
Graph export contains node IDs/kinds and edges, excluding dialogue, choice labels
and asset paths. Graphviz is not required.

`scenarioStatistics`, `scenarioGraph`, and `scenarioGraphDot` are available in
`/tooling`. Reading length defaults to 500 Unicode characters/minute and counts
all authored branches, not one player's route. `validateScenarios(entries,
{ lint: true })` adds empty scene, unused registry and unreachable node warnings.
Empty choices, duplicate character IDs and reachable automatic loops error;
duplicate/blank choice labels warn. Implicit scene exhaustion remains legal.
Duplicate JavaScript scene object keys are overwritten before evaluation and
cannot be diagnosed by the runtime validator; use source linting for those.
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

## Save/Load panel

`SaveLoadPanel` in `/web` creates a native modal with save/load/delete controls,
slot metadata, readable error status, initial focus, Escape close and return focus.
Inject `{ saves, onSave, onLoad, onError?, labels? }`. `open("save")` shows manual
slots, `open("load")` includes auto/quick slots. Busy operations are serialized.
The host's `onLoad` should restore an engine and call `run()`; errors remain visible.
Subscribe `action => panel.handleAction(action)` from an InputRouter at overlay
priority to consume quickSave/quickLoad/cancel and block background actions while
open. Destroy the panel when its host is disposed. `saveLoadPanelCss` provides
structural styles only. See `examples/generic/index.html` for a public example
that runs without local stories or artwork.
## Audio

`AudioController` in `/core` owns BGM state and channel volumes through an injected
`AudioAdapter`. `BrowserAudioAdapter` in `/web` lazily decodes registered sources
with Web Audio. Call `adapter.unlock()` from a user gesture. The host owns asset
URLs; no audio files are shipped.

```ts
import { AudioController } from "asternihva-adv-engine/core";
import { BrowserAudioAdapter } from "asternihva-adv-engine/web";
const adapter = new BrowserAudioAdapter({ assets: { music: "/audio/music.ogg" } });
const audio = new AudioController(adapter);
await audio.play("bgm", "music", { loop: true, fadeInMs: 200, crossfadeMs: 500 });
await audio.stop("bgm", { fadeOutMs: 300 });
```

Pass `audio` to `AdvEngine`. Additive nodes use `{ type: "audio", channel: "bgm",
id: "music" }`; omit `id` to stop a channel. Lines optionally use `voice: "clip"`.
Register IDs in `GameDefinition.audioAssets` for validation. BGM/Voice replace
prior playback, SE overlaps. BGM supports loop, fade-in/out and crossfade;
volumes are 0–1 and effective gain is master × channel × per-play volume.
Durations are milliseconds. Playback APIs resolve when playback is scheduled,
not when a clip ends. Failed decode can retry; stop/destroy invalidates pending
requests. Changing volume replaces an active gain ramp.

`settings.update({ audio: { master: 1, bgm: .7, se: 1, voice: 1 } })` persists
volumes. `settings.bindAudio(audio)` applies them and returns an unsubscribe
function. Legacy settings without `audio` use full-volume defaults. Voice stops
on line changes unless `new AudioController(adapter, false)` is used. SaveState
optionally includes only BGM ID/loop/per-play volume; loading clears one-shots
and starts BGM from the beginning. Earlier v1 saves remain supported.

Renderers can expose a logical `initialExpression` when choosing their own
fallback; SpriteRenderer does so. Custom renderers should set this property or
`CharacterDefinition.defaultExpression` for reliable restoration of their initial
expression. Unknown registered expressions/BGM in a save are rejected before
playback is changed.

The bundled example shell connects Save/Load from its title and menu, F5/F9 through
one InputRouter, and master/BGM/SE/voice sliders through GameSettingsStore. Loading
constructs the saved chapter's stage before restoring logical state and omits the
fresh chapter intro. Existing story modules and assets remain external. Opening
an overlay or saving/loading stops AUTO/SKIP; leaving a chapter cancels its pending
intro/playback and closes its audio context. A cancelled run is never marked CLEAR.
When browser storage is denied, the example reports that saves last only for the
current page session. Hosts should report storage quota errors instead of silently
claiming durable saves.

`ScenarioCatalog.createScenario(id, options)` selects and constructs an engine
without executing its opening nodes. Use it when a host must retain a handle
before `restoreSaveState()` and cancel a chapter switch. Catalog metadata overrides
are applied consistently for new and loaded engines. `stop()`/`destroy()` during
restore invalidates that restore; it reports `SaveError("busy")` after the pending
adapter operation settles and does not commit saved variables/progress. A cancelled
or failed restore cannot be saved until another restore or playback reaches a safe
checkpoint. Renderer adapters must suppress late work after their own destruction.
Destroyed engines cannot be run, restored, or saved; construct a fresh engine.

For duplicate scene keys that JavaScript would overwrite before runtime validation,
use the optional static source checker:

```sh
bun add -d typescript
asternihva-adv-engine scenario lint-source ./sample.mjs
```

`lintScenarioSource(source)` is also exported from `/tooling`. It parses JS without
executing the module, detects duplicate static keys in each inline `scenes` table,
and reports syntax errors with line/column locations. Diagnostic output contains
codes and counts, not source text, scene IDs or dialogue. Computed keys, spread
properties and non-inline scenes tables produce coverage warnings; their dynamic
values require the normal runtime Validator. TypeScript is a lazy optional peer:
all package entry points and other CLI commands work without that parser installed.

## Character definitions and web integration

A character has a stable `id`, display `name`, registered `renderer` key and
renderer assets. For sprites, `assets.expressions` maps expression IDs to URLs;
`defaultExpression` selects the initial one. A line's `expression` switches the
speaker's sprite. Scene `commands` show/hide or position characters. Register
background IDs in `backgrounds` and use `{ type: "scene", background: "sample-room" }`.
Choice `options` contain display `text`, a target `next`, and optional scalar
variable assignments in `set`. Game-specific fonts, crops, theme and registries
belong to the consumer application.

Inject `gameViewportCss`, `spriteRendererCss` and `domUiCss` from `/web`, then
create a `.adv-viewport` with separate background, character and dialogue layers.
Destroy the engine when switching chapters or disposing the host; it owns the
supplied stage/UI/audio. Keep SaveStore/settings/progress across chapter switches.
Use `catalog.createScenario(id, options)` to retain the engine handle before an
async restore, then `restoreSaveState` and `run`. A renderer construction failure
releases instances it already created; missing renderer registrations fail first.
Do not share a stage/UI between simultaneously running engines.

## Independent consumer verification

`npm run consumer:test` packs the package, copies `tests/fixtures/consumer/` into
an external temporary project, installs the tarball and typechecks its own
scenario/host. The bundle uses only documented `/core` and `/web` imports. The
HTTP server exposes only consumer output, not this checkout. Chromium plays
Title → Dialogue → Choice → expression/background → line and choice Save/Load
→ End with the project's own SVGs. Bundler checks reject checkout/example imports.
Install Playwright Chromium, or set `CHROMIUM_EXECUTABLE_PATH`. CI runs the E2E.

A consumer owns its page, navigation, registries and lifecycle. Sample helpers
are outside package exports. For TypeScript sprite assets, use `satisfies SpriteAssets`
from `/web` to check renderer-specific settings (`fullbody` or `portrait`). The
open-ended CharacterDefinition.assets also supports custom renderer contracts.

## Desktop and mobile landscape

The web target is Desktop or Mobile Landscape with a centered 16:9 surface. Use
`viewport-fit=cover` in the viewport meta tag and opt in to `mobileLandscapeCss`
plus `LandscapeViewport` from `/web`:

```ts
import { LandscapeViewport, mobileLandscapeCss } from 'asternihva-adv-engine/web';
style.textContent += mobileLandscapeCss;
const viewport = new LandscapeViewport(host, {
  shell: document.body,
  message: 'Please rotate your device to landscape.',
  onOrientationChange: portrait => { if (portrait) stopAutoAndSkip(); },
});
// When disposing this host:
viewport.destroy();
```

The helper tracks visual-viewport resize/pan, fits inside safe-area insets and
restores host styles/listeners on destroy. Portrait uses a native blocking dialog
and makes the game inert/hidden; it does not offer a compressed portrait game.
The host chooses its message and pauses auto/skip. Rotation preserves runtime
position. Custom overlays and buttons remain application responsibilities.
Define safe-area overrides on `:root` so both the shell and game inherit them.

`mobileLandscapeCss` provides short-landscape dialogue/choice sizes, scrollable
panels and 44px touch controls. Logs remain selectable. Fullbody sprite mode
preserves generic fixture framing; real game crop/theme decisions belong to the
consumer. Test supported screens at `npm run mobile:test`: actual generic sample
on desktop, iPhone-like and Android-like Chromium touch contexts, including
portrait rotation, safe-area simulation, short viewport and Save/Load. Emulation
is not a physical iPhone/Safari guarantee; confirm on real devices before launch.
