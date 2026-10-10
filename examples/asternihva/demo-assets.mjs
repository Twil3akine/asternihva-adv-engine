import { assetManifest } from "./asset-manifest.mjs";

const base = new URL("./", import.meta.url);
const localRoot = new URL("public/characters/", base);

async function assetExists(source) {
  try { return (await fetch(source, { method: "HEAD" })).ok; }
  catch { return false; }
}

/** Demo-only discovery; private images are never needed by the engine build. */
export async function loadDemoAssets(fetchManifest = fetch, probeImage = assetExists) {
  let ready;
  try {
    const response = await fetchManifest(new URL(".local-assets.json", localRoot), { cache: "no-store" });
    if (response.ok) ready = await response.json();
  } catch {
    // A checkout without local art still has the bundled placeholder demo.
  }

  const missing = [];
  const characters = await Promise.all(assetManifest.map(async (definition) => {
    const expressions = Object.fromEntries(Object.entries(definition.expressions)
      .map(([id, filename]) => [id, new URL(`${definition.id}/${filename}`, localRoot).href]));
    const entries = Object.entries(expressions);
    const availability = entries.map(([id]) => ready?.version === 1 &&
      ready.characters?.[definition.id]?.[id] === `${definition.id}/${definition.expressions[id]}`);
    // Check only the first required expression. Other images load on demand in the renderer.
    const initialIndex = entries.findIndex(([id]) => id === definition.defaultExpression);
    if (availability[initialIndex]) {
      try { availability[initialIndex] = await probeImage(entries[initialIndex][1]); }
      catch { availability[initialIndex] = false; }
    }
    const local = availability.every(Boolean);
    entries.forEach(([id], index) => {
      if (!availability[index]) missing.push(definition.expressions[id]);
    });
    const fallback = (id) => new URL(`assets/${definition.id}-${
      id === "smile" || id === "happy" ? "smile" :
      id === "surprised" && definition.id === "noah" ? "surprised" : "normal"
    }.svg`, base).href;
    return {
      id: definition.id,
      name: definition.name,
      renderer: "sprite",
      defaultExpression: definition.defaultExpression,
      local,
      assets: {
        displayMode: local ? "portrait" : "fullbody",
        portrait: definition.portrait,
        expressions: local ? expressions : Object.fromEntries(entries.map(([id]) => [id, fallback(id)])),
      },
    };
  }));
  return { characters, missing };
}
