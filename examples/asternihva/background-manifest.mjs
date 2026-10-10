const base = new URL('./', import.meta.url);

export const backgroundManifest = {
  'room-night-wide': {
    src: new URL('public/backgrounds/room-night-wide.png', base).href,
    anchorX: 0.5,
    anchorY: 0.5,
    overlay: 0.18,
  },
  'room-night-window': {
    src: new URL('public/backgrounds/room-night-window.png', base).href,
    anchorX: 0.5,
    anchorY: 0.5,
    overlay: 0.14,
  },
};

/** Only inspect the opening background; absent local artwork uses the CSS gradient. */
export async function initialBackground(fetchAsset = fetch) {
  try {
    const response = await fetchAsset(backgroundManifest['room-night-window'].src, { method: 'HEAD' });
    return response.ok ? 'room-night-window' : undefined;
  } catch { return undefined; }
}
