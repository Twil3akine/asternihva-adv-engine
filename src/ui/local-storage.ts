import type { StorageAdapter } from "../save.js";

/** Access browser storage only on construction; inject Storage for tests or other hosts. */
export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = globalThis.localStorage) {}
  getItem(key: string): string | null { return this.storage.getItem(key); }
  setItem(key: string, value: string): void { this.storage.setItem(key, value); }
  removeItem(key: string): void { this.storage.removeItem(key); }
}
