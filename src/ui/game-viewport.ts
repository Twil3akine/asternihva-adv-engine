/** A centered 16:9 game surface; all presentation layers share its coordinates. */
export const gameViewportCss = `
.adv-viewport {
  position: relative;
  width: var(--adv-fitted-width, min(100vw, calc(100dvh * 16 / 9)));
  aspect-ratio: 16 / 9;
  overflow: hidden;
  isolation: isolate;
  container-type: inline-size;
}
.adv-background, .adv-character-layer { position: absolute; inset: 0; }
.adv-background { z-index: 0; background-size: cover; background-position: center; }
.adv-character-layer { z-index: 10; }
`;
