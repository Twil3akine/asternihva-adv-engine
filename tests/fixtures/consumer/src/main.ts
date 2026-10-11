import { CharacterStage, ScenarioCatalog, SaveStore, InputRouter, type AdvEngine, type SaveState } from 'asternihva-adv-engine/core';
import { DomUi, SpriteRenderer, LocalStorageAdapter, SaveLoadPanel, domUiCss, spriteRendererCss, gameViewportCss, saveLoadPanelCss } from 'asternihva-adv-engine/web';
import { chapter1 } from '../scenario/chapter1';
const element = (id: string) => { const node = document.getElementById(id); if (!node) throw Error(`Missing ${id}`); return node; };
const root = element('game'), title = element('title');
const style = document.createElement('style'); style.textContent = gameViewportCss + spriteRendererCss + domUiCss + saveLoadPanelCss; document.head.append(style);
const input = new InputRouter(), catalog = new ScenarioCatalog([{ id: 'chapter1', entry: chapter1 }]);
const saves = new SaveStore(new LocalStorageAdapter(), 'third-party');
let engine: AdvEngine | undefined;
async function start(state?: SaveState) {
  engine?.destroy(); engine = undefined; title.hidden = true; delete root.dataset.finished;
  const ui = new DomUi({ root, background: element('background'), speaker: element('speaker'), text: element('text'), choices: element('choices'), advanceTarget: element('dialogue') }, { input });
  const stage = new CharacterStage(element('stage'), chapter1.characters, [new SpriteRenderer({ crossfadeDuration: 0 })]);
  engine = catalog.createScenario('chapter1', { stage, ui, saves, autosave: true });
  if (state) await engine.restoreSaveState(state);
  const current = engine;
  void current.run().then(() => { if (current.ended && engine === current) root.dataset.finished = 'true'; }).catch(report);
}
function report(error: unknown) { element('status').textContent = error instanceof Error ? error.message : 'Operation failed'; }
const panel = new SaveLoadPanel(root, { saves,
  onSave: async slot => { if (!engine) throw Error('Start first'); await engine.save(slot); },
  onLoad: async slot => { const { state } = await saves.load(slot); await start(state); }, onError: report,
});
input.subscribe(action => panel.handleAction(action), 100);
element('start').addEventListener('click', () => { void start().catch(report); });
element('save').addEventListener('click', () => { void panel.open('save').catch(report); });
element('load').addEventListener('click', () => { void panel.open('load').catch(report); });
element('advance').addEventListener('click', () => input.dispatch('advance'));
window.addEventListener('pagehide', () => { engine?.destroy(); panel.destroy(); }, { once: true });
root.dataset.ready = 'true';
