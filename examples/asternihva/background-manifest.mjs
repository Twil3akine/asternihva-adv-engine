const base = new URL('./', import.meta.url);

export const backgroundManifest = {
  'room-night': {
    src: new URL('public/backgrounds/room-night.png', base).href,
    anchorX: 0.5,
    anchorY: 0.5,
    overlay: 0.18,
  },
};

/** Only inspect the first background; absent local artwork uses the CSS gradient. */
export async function initialBackground(fetchAsset = fetch) {
  try {
    const response = await fetchAsset(backgroundManifest['room-night'].src, { method: 'HEAD' });
    return response.ok ? 'room-night' : undefined;
  } catch { return undefined; }
}
