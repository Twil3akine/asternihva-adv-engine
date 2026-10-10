const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function until(predicate, message, attempts = 400) {
  for (let index = 0; index < attempts; index++) {
    if (predicate()) return;
    await wait(25);
  }
  throw new Error(message);
}

const stateKey = root => `${root.dataset.mode}:${root.dataset.page ?? ""}:${document.querySelector("#text").textContent}`;

async function waitForFirstLine() {
  const root = document.querySelector("#game");
  await until(() => root.dataset.mode === "line", "Scenario did not enter its first dialogue line");
  assert(document.querySelector("#text").textContent.length > 0, "Scenario did not start at intro");
}

async function advanceOne() {
  const root = document.querySelector("#game");
  if (root.dataset.mode === "choice") {
    const choice = document.querySelector(".adv-choice");
    assert(choice, "Choice mode has no selectable option");
    choice.click();
    await until(() => root.dataset.mode !== "choice", "Selecting a choice did not continue the scenario");
    return;
  }
  assert(root.dataset.mode === "line", `Cannot advance from ${root.dataset.mode}`);
  const before = stateKey(root);
  root.click();
  await until(() => stateKey(root) !== before, "Root click did not advance the dialogue or page");
}

async function playToEnd({ checkFraming = false, checkLog = false } = {}) {
  const root = document.querySelector("#game");
  let framingChecked = false;
  let logChecked = false;
  for (let step = 0; step < 100 && root.dataset.mode !== "ended"; step++) {
    const text = document.querySelector("#text").textContent;
    if (checkFraming && !framingChecked && document.querySelectorAll('#stage [data-visible="true"]').length === 3) {
      const visible = [...document.querySelectorAll("#stage .adv-sprite-character[data-visible=\"true\"]")];
      assert(visible.length === 3, `Trio framing showed ${visible.length} visible characters`);
      assert(new Set(visible.map(character => character.dataset.character)).size === 3, "Trio framing duplicated a character");
      const positions = visible.map(character => character.style.getPropertyValue("--adv-x")).sort();
      assert(positions.join(",") === "20%,50%,80%", `Trio positions were ${positions.join(",")}`);
      framingChecked = true;
    }
    if (checkLog && !logChecked && document.querySelectorAll('#stage [data-visible="true"]').length === 3) {
      const log = document.querySelector("#log-panel");
      document.querySelector('[data-control="log"]').click();
      await until(() => log.open, "LOG did not open during the long dialogue");
      assert(log.querySelectorAll(".adv-log-avatar img").length >= 3, "LOG missing character portraits");
      log.close();
      await until(() => !log.open, "LOG did not close");
      logChecked = true;
    }
    if (root.dataset.mode === "choice") {
      assert(document.querySelectorAll(".adv-choice").length === 3, "The scenario choice list is incomplete");
    }
    await advanceOne();
  }
  assert(root.dataset.mode === "ended", "Scenario did not reach its end");
  if (checkFraming) assert(framingChecked, "Trio framing was never reached");
  if (checkLog) assert(logChecked, "Long dialogue was never added to LOG");
  assert(!document.querySelector("#end-card").hidden, "End card was not shown");
  assert(document.querySelector("#end-title").textContent.length > 0, "End card title did not use catalog metadata");
}

async function startFromChapter(id) {
  const root = document.querySelector("#game");
  const plays = document.querySelectorAll("#chapter-list [data-scenario-id]");
  assert(plays.length === 3, `Expected three catalog chapters, got ${plays.length}`);
  (id ? [...plays].find(button => button.dataset.scenarioId === id) : plays[0]).click();
  assert(root.dataset.screen === "game" && root.dataset.mode === "intro", "Chapter PLAY did not enter game intro");
  await waitForFirstLine();
}

/** Run in a browser after opening examples/asternihva/index.html. */
export async function testGameShell() {
  const root = document.querySelector("#game");
  assert(root && document.querySelector("#title-screen") && document.querySelector("#chapter-screen"), "Demo shell markup is missing");
  await until(() => root.dataset.screen === "title" && root.dataset.shellReady === "true", "Demo did not open on its title screen");
  assert(document.querySelector("#title-screen h1").textContent === "Asternihva Project", "Title screen heading is missing");

  document.querySelector('[data-shell-action="chapter"]').click();
  await until(() => document.querySelectorAll("#chapter-list .chapter-entry").length === 3, "Catalog chapters were not rendered");
  const chapter = document.querySelector("#chapter-list .chapter-entry");
  assert(chapter.textContent.includes("EP.00") && chapter.textContent.includes("小さな光"), "Chapter metadata is incomplete");
  assert(chapter.querySelectorAll("p").length === 2, "Chapter description is missing");
  root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await until(() => root.dataset.screen === "title", "Escape did not return from chapter selection to title");

  document.querySelector('[data-shell-action="settings"]').click();
  const settings = document.querySelector("#settings-panel");
  await until(() => settings.open, "Title SETTINGS did not open settings");
  document.querySelector("[data-settings-back]").click();
  await until(() => !settings.open && root.dataset.screen === "title", "Settings back did not return to title");

  const controls = document.querySelector("#controls");
  document.querySelector('[data-shell-action="start"]').click();
  assert(root.dataset.screen === "game" && root.dataset.mode === "intro", "START did not enter intro");
  await waitForFirstLine();
  const beforeControlClick = stateKey(root);
  controls.click();
  await wait(75);
  assert(stateKey(root) === beforeControlClick, "Clicking the controls advanced the dialogue");
  await advanceOne();
  assert(root.dataset.mode === "line", "Root click did not advance the scenario");
  await playToEnd({ checkFraming: true, checkLog: true });

  document.querySelector("[data-end-chapters]").click();
  await until(() => root.dataset.screen === "chapter", "End card did not return to chapter selection");
  await startFromChapter();
  await playToEnd();

  document.querySelector("[data-replay]").click();
  assert(root.dataset.screen === "game" && root.dataset.mode === "intro", "Replay did not restart the selected chapter");
  await waitForFirstLine();
  await playToEnd();

  document.querySelector("[data-end-chapters]").click();
  await until(() => root.dataset.screen === "chapter", "Chapter return action did not restore the chapter screen");
  await startFromChapter();
  await playToEnd();
  for (const id of ["ep01", "ep02"]) {
    document.querySelector("[data-end-chapters]").click();
    await until(() => root.dataset.screen === "chapter", "Chapter screen did not reopen");
    await startFromChapter(id);
    await playToEnd();
  }
  return { title: true, chapterSelect: true, settingsReturn: true, introAndLine: true, controlsExcluded: true, choiceAndEnd: true, trioFraming: true, fullLog: true, chapterRestart: true, replay: true, allThreeScenarios: true };
}
