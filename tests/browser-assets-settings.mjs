import { BackgroundPresenter, DecodedImageCache } from "../dist/index.js";
import { assetManifest } from "../examples/asternihva/asset-manifest.mjs";

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function until(predicate, message, attempts = 200) {
  for (let index = 0; index < attempts; index++) {
    if (predicate()) return;
    await wait(25);
  }
  throw new Error(message);
}

const settingButtons = (name) => [...document.querySelectorAll(`[data-setting="${name}"]`)];

function selectedSetting(name) {
  return settingButtons(name).find(button => button.getAttribute("aria-pressed") === "true")?.dataset.value;
}

function clickSetting(name, value) {
  const target = document.querySelector(`[data-setting="${name}"][data-value="${value}"]`);
  assert(target, `Missing setting option ${name}=${value}`);
  if (target.getAttribute("aria-pressed") !== "true") target.click();
}

function storedSettings(raw) {
  try {
    const envelope = JSON.parse(raw);
    const settings = envelope?.settings;
    if (envelope?.version === 1
      && ["slow", "normal", "fast"].includes(settings?.autoSpeed)
      && typeof settings.characterMotion === "boolean"
      && typeof settings.uiAnimation === "boolean"
      && Object.keys(settings).length === 3) return settings;
  } catch { /* Invalid saved data uses the documented defaults. */ }
  return { autoSpeed: "normal", characterMotion: true, uiAnimation: true };
}

function assertSettingsControls(settings) {
  assert(selectedSetting("autoSpeed") === settings.autoSpeed, "AUTO speed control does not reflect the saved setting");
  assert(selectedSetting("characterMotion") === String(settings.characterMotion), "Character motion control does not reflect the saved setting");
  assert(selectedSetting("uiAnimation") === String(settings.uiAnimation), "UI animation control does not reflect the saved setting");
}

async function openSettings() {
  const menu = document.querySelector("#menu-panel");
  const panel = document.querySelector("#settings-panel");
  if (!menu.open) document.querySelector('[data-control="menu"]').click();
  await until(() => menu.open, "MENU did not open");
  document.querySelector('[data-menu-action="settings"]').click();
  await until(() => panel.open, "Settings did not open");
  return { menu, panel };
}

async function closeMenu() {
  const menu = document.querySelector("#menu-panel");
  if (menu.open) document.querySelector('[data-menu-action="resume"]').click();
  await until(() => !menu.open, "MENU did not close");
}

async function resetSettingsThroughUi() {
  const { panel } = await openSettings();
  clickSetting("autoSpeed", "normal");
  clickSetting("characterMotion", "true");
  clickSetting("uiAnimation", "true");
  document.querySelector("[data-settings-back]").click();
  await until(() => !panel.open && document.querySelector("#menu-panel").open, "Settings back button did not return to MENU");
  await closeMenu();
}

async function advanceUntil(textPart) {
  const game = document.querySelector("#game");
  const text = document.querySelector("#text");
  const dialogue = document.querySelector("#dialogue");
  await until(() => game.dataset.mode === "line", "Demo did not enter dialogue");
  for (let index = 0; index < 40; index++) {
    if (game.dataset.mode === "line" && text.textContent.includes(textPart)) return;
    const before = `${game.dataset.mode}:${game.dataset.page}:${text.textContent}`;
    if (game.dataset.mode === "choice") document.querySelector(".adv-choice")?.click();
    else dialogue.click();
    await until(() => `${game.dataset.mode}:${game.dataset.page}:${text.textContent}` !== before, "Dialogue did not advance");
  }
  throw new Error(`Could not reach dialogue containing ${textPart}`);
}

async function testBackgroundPresenter() {
  const fixture = document.createElement("div");
  fixture.className = "game background adv-background";
  fixture.style.cssText = "position:fixed;z-index:500;inset:0;width:320px;height:180px;";
  document.body.append(fixture);
  const cache = new DecodedImageCache({ maxDecodedImages: 2 });
  const presenter = new BackgroundPresenter(fixture, { imageCache: cache, transitionDuration: 300 });
  const room = new URL("../examples/asternihva/assets/room.svg", import.meta.url);
  const second = new URL("../examples/asternihva/assets/noah-normal.svg", import.meta.url);
  const token = `browser-assets-settings-${Date.now()}`;
  room.searchParams.set("case", `${token}-room`);
  second.searchParams.set("case", `${token}-second`);
  try {
    assert(fixture.querySelectorAll(".adv-background-image").length === 0, "Background fixture already contains images");
    await presenter.set({ src: room.href });
    assert(getComputedStyle(fixture.querySelector(".adv-background-visual")).isolation === "isolate", "Background images blend with the fallback gradient");
    let image = fixture.querySelector(".adv-background-image");
    assert(image?.naturalWidth > 0, "Bundled room SVG did not decode in the isolated background fixture");
    assert(new URL(image.src).pathname.endsWith("/assets/room.svg"), "Background presenter loaded the wrong room asset");

    const transition = presenter.set({ src: second.href });
    await until(() => fixture.querySelectorAll(".adv-background-image").length === 2, "Background crossfade did not retain both images during transition");
    const images = [...fixture.querySelectorAll(".adv-background-image")];
    const animations = images.flatMap(backgroundImage => backgroundImage.getAnimations());
    assert(animations.length === 2, "Background crossfade did not animate the incoming and outgoing images");
    for (const animation of animations) {
      animation.pause();
      animation.currentTime = 150;
    }
    const midpointOpacity = images.map(backgroundImage => Number(getComputedStyle(backgroundImage).opacity));
    assert(midpointOpacity.every(opacity => Math.abs(opacity - 0.5) < 0.01), `Background crossfade midpoint opacities were ${midpointOpacity}`);
    assert(cache.stats.maxDecodedImages === 2 && cache.stats.decodedImages <= 2 && cache.stats.pinnedImages === 2,
      `Background cache exceeded its two-image bound during crossfade: ${JSON.stringify(cache.stats)}`);

    for (const animation of animations) animation.finish();
    await transition;
    image = fixture.querySelector(".adv-background-image");
    assert(fixture.querySelectorAll(".adv-background-image").length === 1, "Background replacement retained an outgoing image");
    assert(image?.naturalWidth > 0 && new URL(image.src).pathname.endsWith("/assets/noah-normal.svg"), "Second bundled background fixture asset did not load");
    assert(cache.stats.decodedImages <= 2 && cache.stats.pinnedImages === 1,
      `Background cache did not release the outgoing lease: ${JSON.stringify(cache.stats)}`);
    return { roomSvg: true, secondSvg: true, crossfadeMidpoint: true, isolatedCache: cache.stats };
  } finally {
    presenter.destroy();
    cache.clearUnused();
    fixture.remove();
  }
}

/** Run after opening the actual example page in a browser. */
async function startDemoFromTitle() {
  const game = document.querySelector('#game');
  if (game.dataset.screen !== 'title') return;
  await until(() => game.dataset.shellReady === 'true', 'Shell did not initialize');
  game.querySelector('[data-shell-action="start"]').click();
}

export async function testAssetsAndSettings() {
  await startDemoFromTitle();
  const game = document.querySelector("#game");
  const background = document.querySelector("#background");
  const scenarioTitle = document.querySelector("#scenario-title");
  assert(game && background && scenarioTitle, "Demo is missing its game, background, or scenario title element");
  await until(() => game.dataset.mode === "line", "Demo did not enter dialogue");
  assert(scenarioTitle.textContent === "EP.00\n小さな光", `Scenario title was ${JSON.stringify(scenarioTitle.textContent)}`);

  const backgroundUrl = new URL("../examples/asternihva/public/backgrounds/room-night-window.png", import.meta.url);
  const requestedBackground = performance.getEntriesByType("resource").some(entry => new URL(entry.name).pathname === backgroundUrl.pathname);
  assert(requestedBackground, "Demo did not request the room-night-window opening background asset");
  const backgroundResponse = await fetch(backgroundUrl, { method: "HEAD", cache: "no-store" });
  const actualBackground = background.querySelector(".adv-background-image");
  if (!backgroundResponse.ok) {
    assert(!actualBackground, "Missing room-night-window asset unexpectedly produced a background image");
    assert(getComputedStyle(background).backgroundImage.includes("linear-gradient"), "Missing room-night-wide asset did not leave the CSS gradient visible");
  } else {
    assert(actualBackground?.complete && actualBackground.naturalWidth > 0, "Available room-night-window asset did not load");
  }

  const backgroundPresenter = await testBackgroundPresenter();
  const fullscreen = document.querySelector("#fullscreen");
  assert(fullscreen, "Demo is missing the fullscreen control");
  if (!document.fullscreenEnabled) assert(fullscreen.disabled, "Fullscreen control must be disabled when fullscreen is unsupported");

  const storageKey = "web-adv-engine:settings:v1";
  const priorStorage = localStorage.getItem(storageKey);
  let menu, settingsPanel;
  let logPanel;
  try {
    ({ menu, panel: settingsPanel } = await openSettings());
    assertSettingsControls(storedSettings(priorStorage));

    clickSetting("autoSpeed", "slow");
    clickSetting("characterMotion", "false");
    clickSetting("uiAnimation", "false");
    assert(game.dataset.uiAnimation === "off", "UI animation OFF did not update the game presentation state");
    assertSettingsControls({ autoSpeed: "slow", characterMotion: false, uiAnimation: false });
    const persisted = JSON.parse(localStorage.getItem(storageKey));
    assert(persisted?.version === 1
      && persisted.settings?.autoSpeed === "slow"
      && persisted.settings?.characterMotion === false
      && persisted.settings?.uiAnimation === false
      && Object.keys(persisted.settings).length === 3,
    "Settings changes were not persisted in the versioned envelope");

    const choiceProbe = document.createElement("button");
    choiceProbe.className = "adv-choice";
    game.append(choiceProbe);
    try {
      assert(getComputedStyle(choiceProbe).transitionDuration.split(",").every(value => Number.parseFloat(value) === 0), "UI animation OFF left a choice transition enabled");
    } finally {
      choiceProbe.remove();
    }

    const settingsOpener = document.querySelector('[data-menu-action="settings"]');
    if (typeof settingsPanel.requestClose === "function") settingsPanel.requestClose();
    else settingsPanel.dispatchEvent(new Event("cancel", { cancelable: true }));
    await until(() => !settingsPanel.open && menu.open, "Settings cancel did not return to MENU");
    assert(document.activeElement === settingsOpener, "Settings cancel did not restore focus to its MENU opener");
    await closeMenu();

    await advanceUntil("なら、三人で見た秘密");
    const movingCharacters = [...document.querySelectorAll("#stage .adv-sprite-character")].filter(character =>
      character.getAnimations().some(animation => animation.effect?.getKeyframes?.().some(frame =>
        ["translate", "rotate", "scale"].some(property => property in frame))));
    assert(movingCharacters.length === 0, "Character motion OFF still played a WAAPI character motion");

    document.querySelector('[data-control="log"]').click();
    logPanel = document.querySelector("#log-panel");
    await until(() => logPanel.open, "LOG did not open");
    const entries = [...logPanel.querySelectorAll(".adv-log-entry")];
    for (const character of assetManifest) {
      const entry = entries.find(candidate => candidate.querySelector(".adv-log-name")?.textContent === character.name);
      const image = entry?.querySelector(".adv-log-avatar img");
      assert(image, `LOG is missing ${character.name}'s native portrait icon`);
      assert(image.style.getPropertyValue("--adv-log-portrait-scale") === String(character.logPortrait.scale), `${character.name} log icon scale does not match its per-character configuration`);
      assert(image.style.getPropertyValue("--adv-log-portrait-anchor-x") === String(character.logPortrait.anchorX), `${character.name} log icon horizontal anchor does not match its configuration`);
      assert(image.style.getPropertyValue("--adv-log-portrait-anchor-y") === String(character.logPortrait.anchorY), `${character.name} log icon vertical anchor does not match its configuration`);
    }
    logPanel.close();
    await until(() => !logPanel.open, "LOG did not close");
    return { scenarioTitle: true, backgroundMissing: !backgroundResponse.ok, backgroundPresenter, settings: true, settingsCancel: true, motionSuppressed: true, logPortraits: assetManifest.length };
  } finally {
    logPanel?.close();
    if (settingsPanel?.open) {
      settingsPanel.close();
      if (menu && !menu.open) menu.showModal();
    }
    try {
      await resetSettingsThroughUi();
    } finally {
      if (priorStorage === null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, priorStorage);
    }
  }
}

/** Fullscreen needs an actual browser user gesture; unsupported browsers return explicitly. */
export async function testFullscreen() {
  await startDemoFromTitle();
  await until(() => document.querySelector('#game').dataset.mode === 'line', 'Demo did not enter dialogue');
  const { menu, panel } = await openSettings();
  const button = document.querySelector('#fullscreen');
  if (button.disabled) { panel.close(); menu.close(); return { fullscreenSupported: false }; }
  try {
    button.click();
    await until(() => Boolean(document.fullscreenElement) || button.dataset.error, 'Fullscreen did not respond');
    assert(document.fullscreenElement, 'Browser denied fullscreen: ' + button.textContent);
    const rect = document.querySelector('#game').getBoundingClientRect();
    assert(Math.abs(rect.width / rect.height - 16 / 9) < .001, 'Fullscreen stretched the game viewport');
    assert(rect.width <= innerWidth + 1 && rect.height <= innerHeight + 1, 'Fullscreen viewport does not fit');
    await document.exitFullscreen();
    await until(() => !document.fullscreenElement, 'Fullscreen did not exit');
    return { fullscreenSupported: true, entered: true, ratio: rect.width / rect.height, exited: true };
  } finally {
    if (document.fullscreenElement) await document.exitFullscreen();
    panel.close(); menu.close();
  }
}
