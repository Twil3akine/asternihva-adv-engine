# web-adv-engine

A small, renderer-agnostic ADV / visual-novel engine for the web.

The core engine does **not** know any project-specific character names. A game supplies character definitions, scenario data, a UI adapter, and one or more character renderers. The included Asternihva example is dogfooding only.

## v0.1 scope

- Data-driven scenes, dialogue, choices, jumps, and variables
- Generic character registry
- Expression / motion / position commands from scenario data
- Renderer abstraction
- Built-in single-image `SpriteRenderer`
- Replaceable DOM UI adapter
- Snapshot / restore primitive for save systems
- No runtime dependencies
- Asternihva example showing three project characters without hard-coding them into the engine

## Architecture

```text
GameDefinition
  │
  ▼
AdvEngine ───────► UiAdapter
  │
  ▼
CharacterStage
  │
  ├── SpriteRenderer (included)
  ├── Live2DRenderer (SDK-free adapter foundation)
  ├── SpineRenderer  (future / third-party)
  └── CustomRenderer
```

A renderer only needs to implement:

```ts
interface RenderedCharacter {
  show(): void | Promise<void>;
  hide(): void | Promise<void>;
  setExpression(name: string): void | Promise<void>;
  playMotion(name: string): void | Promise<void>;
  setPosition(position: StagePosition): void | Promise<void>;
  destroy(): void;
}
```

That is the seam used to replace PNG sprites with Live2D later without changing scenario data.

## Scenario completion

`UiAdapter` must implement `presentEnd(): void | Promise<void>`. The engine calls
it once when an `end` node is reached or a scene runs out of nodes, after clearing
the active speaker. Adapters should clear dialogue/choice interaction and display
their completion state. `DomUi` removes interaction, clears the speaker and choices,
and replaces the last line with `The End` (`data-mode="ended"`).

`engine.ended` becomes true before the notification. `run()` waits for an async
completion presentation and subsequent calls do nothing until `restore()` resets
completion. `stop()` pauses execution without notifying completion. Errors are
not treated as completion. Existing custom UI adapters need to add `presentEnd()`.

Snapshots store only the scenario cursor and scalar variables, not background or
character rendering state. Restoring a terminal cursor and calling `run()` presents
completion again; restoring an earlier cursor resumes from that node.

## Example scenario

```ts
const game = {
  start: "intro",
  characters: [
    {
      id: "alice",
      name: "Alice",
      renderer: "sprite",
      defaultExpression: "normal",
      assets: {
        expressions: {
          normal: "/alice/normal.png",
          smile: "/alice/smile.png",
          surprised: "/alice/surprised.png",
        },
        motions: {
          nod: {
            keyframes: [{ rotate: "0deg" }, { rotate: "2deg" }, { rotate: "0deg" }],
            duration: 580,
          },
        },
      },
    },
  ],
  scenes: {
    intro: [
      {
        type: "line",
        speaker: "alice",
        text: "Hello.",
        expression: "smile",
        motion: "nod",
        position: "center",
      },
      {
        type: "choice",
        options: [
          { text: "Continue", next: "next" },
          { text: "Leave", next: "end" },
        ],
      },
    ],
    next: [{ type: "line", speaker: "alice", text: "Next scene." }, { type: "end" }],
    end: [{ type: "end" }],
  },
};
```

## Build and run the demo

`SpriteRenderer` accepts `assets.expressions` (a map of expression names to image
URLs); the original flat asset map is also supported. These assets are interpreted
only by the renderer, while the engine passes generic `setExpression` commands.
The initial image uses a valid `defaultExpression`, then `normal`, then `default`,
then the first defined expression. An empty map leaves the sprite without an image.

Images are preloaded and decoded per character. `show()` waits for the initial
image; expression changes retain the previous image until the new one is decoded.
After decoding, expression changes crossfade for 180ms by default. Configure
`new SpriteRenderer({ crossfadeDuration: 250 })` to change the duration, or use
`crossfadeDuration: 0` to disable it. The duration must be finite and non-negative.
Initial images and identical image URLs are not animated. `setExpression()` waits
for the fade; a newer decoded expression cancels the previous fade and removes its
temporary image. Destroy also cancels fades and prevents pending loads from
updating the character. Browsers without Web Animations swap images immediately.
Unknown names and failed loads leave the current image unchanged without throwing.
Repeated requests for the same image do not rewrite its source; the latest valid
request wins when loads overlap. Failed loads are cached for that character instance.
The example's first three lines demonstrate normal → smile → surprised.

The built-in dialogue panel keeps a fixed height for each line, sized from the
viewport and capped for large screens. Its text and choice list scroll inside
the panel when their content is longer than the available space. The speaker
label stays in a fixed position above the text. On small screens, the panel
uses a larger share of the viewport while keeping the same scrolling behavior.
For overflowing dialogue, clicking or pressing an advance key first scrolls to
the bottom; the next advance continues the scenario. Each new line starts at the top.

```sh
npm install
npm run typecheck
npm run build
npm run serve:example
```

Then open:

```text
http://localhost:4173/examples/asternihva/
```

Bun can be used instead of npm:

```sh
bun install
bun run build
python3 -m http.server 4173
```

## Sprite portrait framing

Sprite assets may include `displayMode: "portrait"` and
`portrait: { scale: 2, anchorX: 0.5, anchorY: 0 }`. `scale` sets image width
relative to the character viewport width; image height follows the original aspect
ratio. The viewport clips overflowing content without editing the source image.
An anchor positions the image by `(viewport size - image size) * anchor`:
`anchorX: 0.5` centers it and `anchorY: 0` keeps the top visible. Finite values
outside 0–1 are allowed, for example a slightly negative anchorY adds headroom.
Scale must be finite and positive. Defaults are 1, 0.5, and 0 respectively.

Without framing settings, sprites retain the existing full-body layout. Providing
`portrait` selects portrait mode unless `displayMode: "fullbody"` is explicit.
The sprite-specific handle returned by `SpriteRenderer.create()` exposes
`setDisplayMode("fullbody" | "portrait")` for applications that switch modes.
This leaves expression, framing, and motion state intact. Position commands still
place the viewport on the stage; motions run inside it. Both crossfade images
inherit the same framing variables. Use consistently aligned expression canvases
to avoid artwork moving between expressions. These settings belong to the sprite
renderer; engine nodes and other renderer adapters do not interpret them.

## Sprite motions

Define motion names per character in `assets.motions`. Each `SpriteMotion` has
`keyframes` with optional `translate`, `rotate`, `scale`, `opacity`, `offset`, and
`easing`; timing accepts `duration` in milliseconds (default 500), `easing`
(default `ease`), `iterations` (default 1), and `direction` (default `normal`).
The engine forwards names through `playMotion(name)` without interpreting them.

Motions run on an inner visual layer using Web Animations, independently of
stage position and active-speaker styling. They start without delaying dialogue
and return to the base pose when finished (`fill: none`). A new known motion
cancels the previous one. Unknown or omitted names do nothing; other characters
are unaffected. Destroying a character cancels its motion. There are no implicit
built-in names: the demo defines its own bounce, nod, and pulse animations.

## Live2D integration

`Live2DRenderer` is an SDK-free bridge in `src/adapters/live2d-renderer.ts`.
Live2Dを利用する場合は利用者自身が公式Cubism SDKを導入してください。
The engine includes neither Cubism SDK / Core nor any model files. Download and
configure the SDK in your application using the
[official Cubism SDK downloads](https://www.live2d.com/en/sdk/download/).
Cubism Core has its own license and is distributed through the official package,
as described in the [Cubism Core documentation](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core/).
The engine's MIT license does not cover your SDK or model assets; refer to the
[official SDK licensing information](https://www.live2d.com/en/sdk/license/).

Inject your application-owned factory. It receives the host and character
definition and returns a `Live2DModelAdapter`, immediately or asynchronously:

```ts
import { CharacterStage, Live2DRenderer, SpriteRenderer } from "web-adv-engine";
import type { Live2DModelAdapter } from "web-adv-engine";
import { loadGameLive2DModel } from "./game-live2d-runtime.js";

const live2d = new Live2DRenderer({
  async createModel(host, character): Promise<Live2DModelAdapter> {
    // Your module loads Cubism and maps model-specific names and coordinates.
    return loadGameLive2DModel(host, character);
  },
});
const stage = new CharacterStage(host, game.characters, [new SpriteRenderer(), live2d]);
// Characters choose renderer: "sprite" or renderer: "live2d" in their definitions.
```

The model adapter implements the same `RenderedCharacter` operations:

```text
setExpression("smile")
playMotion("wave")
setPosition("left")
```

Your bridge translates these calls into Cubism operations. Assets, expression and
motion names, positioning, canvases, resize handling, and SDK resources belong to
that bridge. Custom renderers can implement `CharacterRenderer` directly and are
registered alongside sprite and Live2D renderers; scenario nodes do not change.
To match sprite timing, the model adapter's `playMotion` should return or resolve
once playback starts, allowing dialogue to proceed while the motion runs.

The wrapper waits for model initialization before each async command. Optional
`setActive` uses the latest requested value when initialization finishes. Initialization
errors reject the awaiting command; the application decides how to report them.
`destroy()` is idempotent and destroys a model that finishes loading later. Commands
waiting for initialization do nothing if the character was destroyed. The factory
must clean up its own resources if initialization fails; an initialized model's
`destroy()` must cancel any SDK animations and release its resources. No SDK types
are imported into the engine, so build and tests also work without a Cubism install.

## Repository direction

For a later package split, the current modules map naturally to:

```text
packages/
  core/
  renderer-sprite/
  renderer-live2d/
  ui-default/
examples/
  asternihva/
```

Keeping v0.1 as one package makes the API easier to change while the contracts are still settling.

## License

MIT. The example art in this repository is placeholder SVG artwork created only for the demo.

### Asternihvaのローカル立ち絵

実PNGはGitに含めません。`node scripts/import-asternihva-assets.mjs` でローカル素材を導入できます。未導入の場合はDemoの既存SVGを表示します。素材一覧、expression対応、portrait設定、導入手順は [examples/asternihva/ASSETS.md](examples/asternihva/ASSETS.md) を参照してください。

### Game viewport, paging and themes

Use `.adv-viewport` with `gameViewportCss` for a centered 16:9 surface. Put background, character stage, dialogue and choices in this same surface. The host page can center it with a grid and disable page scrolling. The presentation uses container-relative units and scales with this surface.

`domUiCss` includes `defaultThemeCss`. Override CSS custom properties on your viewport to change presentation without replacing the UI adapter. Available tokens are defined in [src/ui/theme.ts](src/ui/theme.ts): dialogue background/border/height/padding/radius/blur, text size/line height/color, name/accent/muted colors, choice/panel backgrounds and transition duration. `--adv-choice-duration` is a number in milliseconds; other duration tokens use CSS time values. Speaker focus uses `--adv-focus-brightness`, `--adv-unfocus-brightness`, `--adv-focus-opacity`, `--adv-unfocus-opacity` and `--adv-focus-duration`. It changes brightness/opacity only; narration treats all characters equally. The Asternihva theme is defined only in [examples/asternihva/theme.css](examples/asternihva/theme.css).

`DomUi` measures each dialogue page against the text element's actual `clientWidth/clientHeight` and scroll extent. The text area must have a bounded size. Click/Enter advances pages; only advancing past the final page resolves `presentLine()`. Grapheme and nearby word boundaries preserve Japanese, emoji and newlines without changing scenario text. Resize remeasures the current page from its original start offset. Optional `DomUiElements.pageIndicator` displays a small next-page cue. Backlog implementations can retain the unchanged `DialoguePresentation.text`.
