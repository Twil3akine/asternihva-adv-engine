/** Metadata and order come from the catalog; presentation stays in the shell. */
export function renderChapterSelect(container, catalog, onPlay, selectedId, progress) {
  container.replaceChildren();
  const rows = [];
  let selected = 0;
  const select = index => {
    selected = index;
    rows.forEach(({ entry, button }, rowIndex) => {
      entry.dataset.selected = String(rowIndex === index);
      button.setAttribute('aria-current', String(rowIndex === index));
    });
  };
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
    if (progress) {
      const state = document.createElement('p');
      state.className = 'chapter-progress';
      state.textContent = progress.getStatus(metadata.id);
      entry.append(state);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '読む';
    button.dataset.scenarioId = metadata.id;
    button.setAttribute('aria-label', `${metadata.title ?? metadata.id}を読む`);
    const index = rows.length;
    if (metadata.id === selectedId) selected = index;
    button.addEventListener('focus', () => select(index));
    entry.addEventListener('pointerenter', () => select(index));
    button.addEventListener('click', () => { select(index); onPlay(metadata.id); });
    button.addEventListener('keydown', event => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      select(next);
      rows[next].button.focus();
    });
    rows.push({ entry, button });
    entry.append(button);
    container.append(entry);
  }
  select(selected);
  return { focus: () => rows[selected]?.button.focus() };
}
