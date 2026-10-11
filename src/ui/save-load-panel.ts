import { SaveError, type SaveStore, type SaveSummary } from '../save.js';
export type SavePanelMode = 'save' | 'load';
export interface SavePanelLabels { save: string; load: string; delete: string; close: string; empty: string; unreadable: string; loading: string; saved: string; deleted: string; slots?: Record<string,string>; }
export interface SaveLoadPanelOptions {
  saves: SaveStore;
  onSave(slot: string): Promise<unknown>;
  onLoad(slot: string): Promise<void>;
  onError?(error: unknown): void;
  labels?: Partial<SavePanelLabels>;
}
const defaults: SavePanelLabels = { save:'Save',load:'Load',delete:'Delete',close:'Close',empty:'Empty',unreadable:'Unreadable save',loading:'Loading…',saved:'Saved',deleted:'Deleted' };
/** Native modal focus containment and Escape behavior, with injected save/load operations. */
export class SaveLoadPanel {
  readonly element: HTMLDialogElement;
  readonly #title: HTMLElement;
  readonly #list: HTMLElement;
  readonly #status: HTMLElement;
  readonly #labels: SavePanelLabels;
  #mode: SavePanelMode = 'load';
  #opener?: HTMLElement;
  #generation = 0;
  #busy = false;
  #destroyed = false;
  readonly #abort = new AbortController();
  #rowsAbort = new AbortController();
  constructor(host: HTMLElement, readonly options: SaveLoadPanelOptions) {
    this.#labels = { ...defaults, ...options.labels };
    this.element = document.createElement('dialog');
    this.element.className = 'adv-panel adv-save-panel';
    const header = document.createElement('header');
    header.className = 'adv-panel-header';
    this.#title = document.createElement('h2');
    const close = document.createElement('button'); close.type='button'; close.textContent=this.#labels.close;
    close.addEventListener('click',()=>this.close(),{signal:this.#abort.signal});
    header.append(this.#title,close);
    this.#list = document.createElement('div'); this.#list.className='adv-save-slots';
    this.#status = document.createElement('p'); this.#status.setAttribute('role','status'); this.#status.setAttribute('aria-live','polite');
    this.element.append(header,this.#list,this.#status);host.append(this.element);
    this.element.addEventListener('cancel',event=>{event.preventDefault();this.close();},{signal:this.#abort.signal});
    this.element.addEventListener('close',()=>{++this.#generation;if(this.#opener?.isConnected)this.#opener.focus();},{signal:this.#abort.signal});
  }
  get busy(): boolean { return this.#busy; }
  async open(mode: SavePanelMode): Promise<void> {
    if (this.#destroyed) return;
    if (mode !== 'save' && mode !== 'load') throw new TypeError('Unknown save panel mode.');
    this.#mode=mode;this.#title.textContent=this.#labels[mode];this.element.setAttribute('aria-label',this.#labels[mode]);
    if(!this.element.open){this.#opener=document.activeElement instanceof HTMLElement?document.activeElement:undefined;this.element.showModal();}
    await this.#refresh();
  }
  close(): void { if(this.element.open)this.element.close(); }
  async #refresh(): Promise<void> {
    const generation=++this.#generation;
    this.#rowsAbort.abort(); this.#rowsAbort = new AbortController();
    this.#list.replaceChildren();
    this.#status.textContent=this.#labels.loading;
    try{
      const entries=await this.options.saves.listSaves();
      const bySlot=new Map(entries.map(e=>[e.slot,e]));
      const slots=this.options.saves.slots.filter(slot=>this.#mode==='load'||!['autosave','quicksave'].includes(slot));
      const present=await Promise.all(slots.map(slot=>this.options.saves.hasSave(slot)));
      if(this.#destroyed||generation!==this.#generation||!this.element.open)return;
      this.#list.replaceChildren();
      slots.forEach((slot,index)=>this.#row(slot,bySlot.get(slot),present[index]!));
      this.#status.textContent='';
      this.#list.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    }catch(error){if(!this.#destroyed&&generation===this.#generation)this.#error(error);}
  }
  #row(slot: string, entry: SaveSummary | undefined, present: boolean): void {
    const generation=this.#generation,mode=this.#mode;
    const row=document.createElement('section');row.className='adv-save-slot';row.dataset.slot=slot;
    const label=document.createElement('p');label.textContent=`${this.#labels.slots?.[slot]??slot}: ${entry ? `${entry.scenarioId} · ${entry.savedAt}` : present?this.#labels.unreadable:this.#labels.empty}`;
    const action=document.createElement('button');action.type='button';action.textContent=this.#labels[this.#mode];action.disabled=this.#busy||(this.#mode==='load'&&!present);
    action.addEventListener('click',()=>{if(generation!==this.#generation||!this.element.open)return;void this.#operate(()=>mode==='save'?this.options.onSave(slot):this.options.onLoad(slot),mode==='load');},{signal:this.#rowsAbort.signal});
    const remove=document.createElement('button');remove.type='button';remove.textContent=this.#labels.delete;remove.disabled=this.#busy||!present;
    remove.addEventListener('click',()=>{if(generation!==this.#generation||!this.element.open)return;void this.#operate(()=>this.options.saves.deleteSave(slot),false,true);},{signal:this.#rowsAbort.signal});
    row.append(label,action,remove);this.#list.append(row);
  }
  #error(error: unknown): void {
    this.#status.textContent=error instanceof SaveError?`${error.code}: ${error.message}`:'Save operation failed.';
    this.options.onError?.(error);
  }
  async #operate(operation:()=>Promise<unknown>,close=false,deleted=false):Promise<void>{
    if(this.#busy||this.#destroyed)return;
    this.#busy=true;this.element.setAttribute('aria-busy','true');
    for(const button of this.#list.querySelectorAll<HTMLButtonElement>('button'))button.disabled=true;
    try{await operation();if(this.#destroyed)return;this.#busy=false;if(close)this.close();else{if(this.element.open)await this.#refresh();this.#status.textContent=deleted?this.#labels.deleted:this.#labels.saved;}}
    catch(error){if(!this.#destroyed){this.#busy=false;if(this.element.open)await this.#refresh();this.#error(error);}}
    finally{this.#busy=false;this.element.setAttribute('aria-busy','false');}
  }
  /** Subscribe this method from an application InputRouter; the component owns no global keys. */
  handleAction(action:string):boolean{
    if(this.#destroyed)return false;
    if(action==='cancel'&&this.element.open){this.close();return true;}
    if(action==='quickSave'){void this.#operate(()=>this.options.onSave('quicksave'));return true;}
    if(action==='quickLoad'){void this.#operate(()=>this.options.onLoad('quicksave'),true);return true;}
    return this.element.open;
  }
  destroy():void{if(this.#destroyed)return;this.#destroyed=true;++this.#generation;this.close();this.#rowsAbort.abort();this.#abort.abort();this.element.remove();}
}
export const saveLoadPanelCss = `
.adv-save-panel { box-sizing: border-box; }
.adv-save-slots { overflow-y: auto; max-block-size: 60vh; }
.adv-save-slot { border-block-end: 1px solid var(--adv-dialog-border, #888); padding-block: .6em; }
.adv-save-slot p { overflow-wrap: anywhere; }
.adv-save-slot button + button { margin-inline-start: .5em; }
.adv-save-panel button:focus-visible { outline: 2px solid var(--adv-accent, currentColor); outline-offset: 2px; }
.adv-save-panel [role="status"] { user-select: text; }
`;
