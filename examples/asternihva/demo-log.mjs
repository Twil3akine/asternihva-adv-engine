/** Build the presentation data kept for one dialogue line in the demo log. */
export function createLogEntry(line) {
  return Object.freeze({
    speakerId: line.speakerId,
    displayName: line.speakerName,
    fullText: line.text,
    expressionId: line.expression,
    narration: !line.speakerId,
  });
}

/** Resolve a log portrait from the caller-provided icon map without guessing expressions. */
export function resolveLogPortrait(entry, icons) {
  if (entry.narration || !entry.speakerId) return undefined;
  const icon = icons?.[entry.speakerId];
  if (!icon || !entry.expressionId) return undefined;
  const source = icon.expressions?.[entry.expressionId];
  if (!source) return undefined;
  return {
    source,
    scale: icon.portrait?.scale ?? 3.8,
    anchorX: icon.portrait?.anchorX ?? 0.5,
    anchorY: icon.portrait?.anchorY ?? 0.15,
  };
}

/** Render log entries using text nodes only; scrolling remains the caller's responsibility. */
export function renderLogEntries(container, entries, resolveIcon) {
  const articles = entries.map((entry, index) => {
    const article = document.createElement("article");
    article.classList.add("adv-log-entry");
    if (entry.narration) article.classList.add("adv-log-entry--narration");
    if (index === entries.length - 1) article.classList.add("adv-log-entry--latest");
    article.setAttribute("role", "listitem");

    const header = document.createElement("header");
    header.classList.add("adv-log-header");
    const icon = entry.narration ? undefined : resolveIcon?.(entry);
    if (icon?.source) {
      const avatar = document.createElement("span");
      avatar.classList.add("adv-log-avatar");
      const image = document.createElement("img");
      image.src = icon.source;
      image.alt = "";
      image.style.setProperty("--adv-log-portrait-scale", String(icon.scale ?? 3.8));
      image.style.setProperty("--adv-log-portrait-anchor-x", String(icon.anchorX ?? 0.5));
      image.style.setProperty("--adv-log-portrait-anchor-y", String(icon.anchorY ?? 0.15));
      image.onerror = () => {
        avatar.remove();
        article.classList.add("adv-log-entry--without-icon");
      };
      avatar.append(image);
      header.append(avatar);
    } else if (!entry.narration) {
      article.classList.add("adv-log-entry--without-icon");
    }

    const name = document.createElement("span");
    name.classList.add("adv-log-name");
    name.textContent = entry.displayName ?? "";
    header.append(name);

    const text = document.createElement("p");
    text.classList.add("adv-log-text");
    text.textContent = entry.fullText ?? "";
    article.append(header, text);
    return article;
  });
  container.replaceChildren(...articles);
  return articles;
}
