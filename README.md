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
  ├── Live2DRenderer (optional adapter; not bundled)
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
        normal: "/alice/normal.png",
        smile: "/alice/smile.png",
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

## Live2D integration

Live2D is intentionally **not bundled**. A future adapter can implement `CharacterRenderer` / `RenderedCharacter` and translate the generic calls:

```text
setExpression("smile")
playMotion("wave")
setPosition("left")
```

into Cubism model operations. This keeps the core engine OSS-friendly and avoids making the engine itself dependent on the Cubism runtime or a specific rendering technology.

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
