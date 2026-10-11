import { AdvEngine, DomUi } from "../dist/index.js";
import { SampleUi } from "../examples/generic/controls.mjs";

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function until(predicate, message, attempts = 100) {
  for (let index = 0; index < attempts; index++) {
    if (predicate()) return;
    await wait(10);
  }
  throw new Error(message);
}

function click(target) {
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

/** Run in the Generic demo page. Exercises real CSS geometry and isolated DomUi input. */
export async function testFocusedUi() {
  const game = document.querySelector("#game");
  const dialogue = document.querySelector("#dialogue");
  const text = document.querySelector("#text");
  const speaker = document.querySelector("#speaker");
  const choices = document.querySelector("#choices");
  const controls = document.querySelector("#controls");
  const pageIndicator = document.querySelector("#page-indicator");
  const menu = document.querySelector("#menu-panel");
  const log = document.querySelector("#log-panel");
  const settings = document.querySelector("#settings-panel");
  assert(game && dialogue && text && speaker && choices && controls && pageIndicator, "Generic dialogue DOM IDs changed");
  assert(menu && log && settings, "Generic menu, LOG, or settings dialog is missing");

  if (game.dataset.screen === "title") {
    await until(() => game.dataset.shellReady === "true", "Shell did not initialize", 1000);
    game.querySelector('[data-shell-action="start"]').click();
  }
  await until(() => game.dataset.mode === "line", "Demo did not finish its intro", 1000);
  await document.fonts?.ready;
  const originals = {
    text: text.textContent,
    speaker: speaker.textContent,
    speakerHidden: speaker.hidden,
    mode: game.dataset.mode,
  };
  const positionCases = [
    ["Alice", "一行だけの台詞です。"],
    ["Alice", "一行目の台詞です。\n二行目の台詞です。"],
    ["Alice", "一行目の台詞です。\n二行目の台詞です。\n三行目の台詞です。"],
    ["", "話者名のない地の文です。"],
  ];
  try {
    game.dataset.mode = "line";
    await nextFrame();
    const textTop = text.getBoundingClientRect().top;
    const dialogueRect = dialogue.getBoundingClientRect();
    for (const [name, value] of positionCases) {
      speaker.textContent = name;
      speaker.hidden = !name;
      text.textContent = value;
      await nextFrame();
      const bodyRect = text.getBoundingClientRect();
      assert(Math.abs(bodyRect.top - textTop) < 1, `Dialogue text moved for ${name || "narration"}: ${bodyRect.top - textTop}px`);
      assert(text.scrollHeight <= text.clientHeight + 1, "Dialogue content overflowed");
      assert(bodyRect.bottom <= controls.getBoundingClientRect().top, "Text overlaps controls");
      assert(bodyRect.top >= dialogueRect.top && bodyRect.bottom <= dialogueRect.bottom + 1, "Dialogue text escaped its panel");
    }
    const controlsRect = controls.getBoundingClientRect();
    const indicatorRect = pageIndicator.getBoundingClientRect();
    assert(controlsRect.left >= dialogueRect.left && controlsRect.right <= dialogueRect.right, "Controls exceed the dialogue panel");
    assert(controlsRect.right + 4 <= indicatorRect.left, "Dialogue controls overlap the page indicator");
  } finally {
    text.textContent = originals.text;
    speaker.textContent = originals.speaker;
    speaker.hidden = originals.speakerHidden;
    if (originals.mode === undefined) delete game.dataset.mode;
    else game.dataset.mode = originals.mode;
  }

  // Keep the live demo untouched while testing root-level bubbling against the actual browser DOM.
  const fixture = document.createElement("section");
  fixture.className = "game adv-viewport focused-ui-fixture";
  fixture.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:500;background:transparent;";
  fixture.innerHTML = `
    <div class="adv-background" data-hit-area></div>
    <section class="adv-dialogue">
      <div class="adv-speaker"></div>
      <div class="adv-text" aria-live="polite"></div>
      <span class="adv-page-indicator"></span>
      <nav class="adv-controls"><button type="button" data-fixture-control>CONTROL</button></nav>
    </section>
    <div class="adv-choices" role="group"></div>
    <dialog data-fixture-dialog><button type="button" data-dialog-body>Dialog body</button></dialog>`;
  game.append(fixture);
  fixture.addEventListener("click", event => event.stopPropagation());
  const fixtureText = fixture.querySelector(".adv-text");
  const fixtureChoices = fixture.querySelector(".adv-choices");
  const fixtureDialog = fixture.querySelector("dialog");
  const ui = new DomUi({
    root: fixture,
    background: fixture.querySelector(".adv-background"),
    speaker: fixture.querySelector(".adv-speaker"),
    text: fixtureText,
    choices: fixtureChoices,
    pageIndicator: fixture.querySelector(".adv-page-indicator"),
  });
  let engine;
  let demoUi;
  try {
    fixture.style.setProperty("--adv-choice-duration", "0ms");
    const longText = "長い台詞の本文です。".repeat(80);
    engine = new AdvEngine({
      game: { start: "start", characters: [], scenes: { start: [
        { type: "line", text: longText },
        { type: "line", text: "次の台詞です。" },
        { type: "end" },
      ] } },
      stage: { setActive() {}, getName() { return ""; }, destroy() {} },
      ui,
    });
    const run = engine.run();
    await until(() => fixture.dataset.mode === "line", "Fixture did not enter its first line");
    assert(Number(fixture.dataset.page) === 1 && fixtureText.textContent !== longText, "Long fixture line did not paginate");

    const initialPage = Number(fixture.dataset.page);
    fixture.dataset.mode = "intro";
    click(fixture);
    assert(Number(fixture.dataset.page) === initialPage, "Viewport click advanced during intro mode");
    fixture.dataset.mode = "line";

    click(fixture.querySelector("[data-fixture-control]"));
    click(fixtureChoices); // Empty choice overlay background while a line is pending.
    fixtureDialog.setAttribute("open", "");
    click(fixture.querySelector("[data-dialog-body]"));
    fixtureDialog.removeAttribute("open");
    assert(Number(fixture.dataset.page) === initialPage, "Control, choice background, or open dialog click advanced dialogue");

    // A single bubbling click on the viewport must advance exactly one page.
    click(fixture.querySelector("[data-hit-area]"));
    await until(() => Number(fixture.dataset.page) > initialPage, "Bubbling viewport click did not advance the page");
    assert(Number(fixture.dataset.page) === initialPage + 1, "One viewport click advanced more than one page");

    let previousPage = Number(fixture.dataset.page);
    for (let count = 0; count < 100 && fixtureText.textContent !== "次の台詞です。"; count++) {
      click(fixture);
      await until(
        () => fixture.dataset.mode === "ended" || fixtureText.textContent === "次の台詞です。" || Number(fixture.dataset.page) !== previousPage,
        "Viewport click did not move to the next page or line",
      );
      if (fixtureText.textContent !== "次の台詞です。") {
        const currentPage = Number(fixture.dataset.page);
        assert(currentPage === previousPage + 1, "Paging skipped or repeated a page");
        previousPage = currentPage;
      }
    }
    assert(fixtureText.textContent === "次の台詞です。", "Last page did not advance to the next dialogue line");
    click(fixture);
    await until(() => fixture.dataset.mode === "ended", "Next-line click did not reach the end state");
    await run;
    assert(engine.ended, "Fixture engine did not end");

    const choice = ui.presentChoice({ prompt: "選択してください。", options: ["左", "右"] });
    await wait(0);
    let selected = false;
    choice.then(() => { selected = true; });
    click(fixtureChoices);
    await wait(0);
    assert(!selected, "Choice background click selected an option");
    click(fixtureChoices.querySelectorAll("button")[1]);
    assert(await choice === 1, "Choice button did not resolve exactly once");

    const edgeText = "\n\n外側の改行は表示から除きます。\n\n内部の改行は残します。\n\n";
    const visibleText = edgeText.replace(/^\n+|\n+$/g, "");
    demoUi = new SampleUi({
      root: fixture,
      background: fixture.querySelector(".adv-background"),
      speaker: fixture.querySelector(".adv-speaker"),
      text: fixtureText,
      choices: fixtureChoices,
      pageIndicator: fixture.querySelector(".adv-page-indicator"),
    });
    const presentation = demoUi.presentLine({ speakerName: "Alice", text: edgeText });
    await until(() => fixtureText.textContent.length > 0, "Newline fixture did not render");
    const renderedPages = [];
    let presentationDone = false;
    presentation.then(() => { presentationDone = true; });
    for (let count = 0; count < 100 && !presentationDone; count++) {
      renderedPages.push(fixtureText.textContent);
      click(fixture);
      await wait(0);
    }
    assert(presentationDone, "Newline fixture did not finish within the page limit");
    await presentation;
    assert(renderedPages.join("") === visibleText, "Presentation did not trim only outer newlines or changed internal newlines");
    assert(edgeText.includes("\n\n内部の改行") && visibleText.includes("\n\n内部の改行"), "Internal paragraph newlines were not retained");
    assert(demoUi.history[0]?.fullText === edgeText, "LOG history did not retain the original full text");

    const finalLine = demoUi.presentLine({ text: "終了確認用の台詞です。" });
    await wait(0);
    click(fixture);
    await finalLine;
    demoUi.presentEnd();
    const endText = fixtureText.textContent;
    click(fixture);
    assert(fixture.dataset.mode === "ended" && fixtureText.textContent === endText, "Viewport click changed the end state");
    return { ids: true, layout: true, rootAdvance: true, exclusions: true, pagination: true, newlinePresentation: true, ended: true };
  } finally {
    engine?.destroy();
    demoUi?.destroy();
    ui.destroy();
    fixture.remove();
  }
}
