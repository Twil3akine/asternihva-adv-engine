import { SpriteRenderer, spriteRendererCss } from "../dist/index.js";

// Run in a real browser: (await import('/tests/browser-crossfade.mjs')).testCrossfade()
export async function testCrossfade(source = "/examples/generic/assets/alice-normal.svg") {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const style = document.createElement("style");
  style.textContent = spriteRendererCss;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;width:300px;height:400px;top:0;left:0";
  document.head.append(style);
  document.body.append(host);
  const character = new SpriteRenderer({ crossfadeDuration: 1000 }).create(host, {
    id: "browser-test", name: "Test", renderer: "sprite",
    assets: { expressions: { normal: source, alternate: `${source}?crossfade-test` }, portrait: { scale: 2, anchorX: 0.5, anchorY: -0.04 } },
  });
  try {
    await character.setExpression("normal");
    const switching = character.setExpression("alternate");
    for (let n = 0; n < 200 && host.querySelectorAll("img").length !== 2; n++) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    const images = [...host.querySelectorAll("img")];
    assert(images.length === 2, "Crossfade layers were not created");
    for (const image of images) for (const animation of image.getAnimations()) {
      animation.pause(); animation.currentTime = 500;
    }
    const weights = images.map(image => Number(getComputedStyle(image).opacity));
    assert(weights.every(weight => Math.abs(weight - 0.5) < 0.001), "Incorrect midpoint weights");
    assert(images.every(image => getComputedStyle(image).mixBlendMode === "plus-lighter"), "Source-over causes a midpoint transparency dip");
    assert(getComputedStyle(images[0].parentElement).isolation === "isolate", "Blending must stay inside the character");
    const rects = images.map(image => image.getBoundingClientRect());
    assert(["x", "y", "width", "height"].every(key => rects[0][key] === rects[1][key]), "Portrait crop changed during crossfade");
    for (const image of images) for (const animation of image.getAnimations()) animation.finish();
    await switching;
    assert(host.querySelectorAll("img").length === 1, "Outgoing layer remained");
    return "PASS: additive crossfade, stable portrait crop, outgoing cleanup";
  } finally {
    character.destroy(); host.remove(); style.remove();
  }
}
