/** Metadata comes from the catalog; DOM presentation belongs to this example. */
export function renderChapterSelect(container, catalog, onPlay) {
  container.replaceChildren();
  for (const metadata of catalog.getScenarios()) {
    const entry = document.createElement('article');
    entry.className = 'chapter-entry';
    for (const [tag, className, value] of [
      ['p', 'chapter-label', metadata.chapter],
      ['h3', '', metadata.title ?? metadata.id],
      ['p', '', metadata.description],
    ]) {
      if (!value) continue;
      const element = document.createElement(tag);
      element.className = className;
      element.textContent = value;
      entry.append(element);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'PLAY';
    button.dataset.scenarioId = metadata.id;
    button.setAttribute('aria-label', `${metadata.title ?? metadata.id}を読む`);
    button.addEventListener('click', () => onPlay(metadata.id));
    entry.append(button);
    container.append(entry);
  }
}
