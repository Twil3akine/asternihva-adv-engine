/** Defaults use zero specificity so a game's stylesheet can override tokens. */
export const defaultThemeCss = `
:where(:root, .adv-viewport) {
  --adv-dialog-bg: rgb(8 13 25 / .8);
  --adv-dialog-border: rgb(210 220 240 / .25);
  --adv-text-color: #f4f6fc;
  --adv-muted-color: #a6b0c2;
  --adv-accent: #9ebce8;
  --adv-name-color: #d9e6ff;
  --adv-dialog-radius: .65cqw;
  --adv-dialog-padding-inline: 2.2cqw;
  --adv-dialog-padding-top: 3.2cqw;
  --adv-dialog-padding-bottom: 2.2cqw;
  --adv-dialog-height: 24%;
  --adv-dialog-blur: 8px;
  --adv-text-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --adv-ui-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --adv-text-weight: 400;
  --adv-name-weight: 600;
  --adv-text-size: 1.55cqw;
  --adv-text-line-height: 1.65;
  --adv-choice-width: 52%;
  --adv-choice-gap: .7cqw;
  --adv-choice-row-size: 5cqw;
  --adv-choice-border: var(--adv-dialog-border);
  --adv-choice-bg: rgb(8 13 25 / .88);
  --adv-choice-hover-bg: rgb(38 47 65 / .95);
  --adv-log-icon-size: clamp(48px, 4.5cqw, 64px);
  --adv-log-entry-gap: 1.2cqw;
  --adv-log-separator: rgb(210 220 240 / .12);
  --adv-panel-bg: rgb(8 13 25 / .96);
  --adv-transition-duration: 200ms;
  --adv-choice-duration: 180ms;
  --adv-focus-brightness: 1;
  --adv-unfocus-brightness: .55;
  --adv-focus-opacity: 1;
  --adv-unfocus-opacity: .82;
  --adv-focus-duration: 200ms;
  --adv-narration-brightness: .9;
  --adv-narration-opacity: 1;
}
`;
