export interface ImageCacheOptions { maxDecodedImages?: number; }
export interface ImageLease { readonly image: HTMLImageElement; release(): void; }
interface CacheEntry {
  image: HTMLImageElement;
  loaded: Promise<boolean>;
  references: number;
  decoded: boolean;
}

/** Shared LRU cache. In-flight and leased images are protected from eviction. */
export class DecodedImageCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #max: number;
  #hits = 0;
  #misses = 0;
  #evictions = 0;

  constructor(options: ImageCacheOptions = {}) {
    this.#max = options.maxDecodedImages ?? 8;
    if (!Number.isInteger(this.#max) || this.#max < 1) throw new Error("maxDecodedImages must be a positive integer.");
  }

  get stats() {
    const entries = [...this.#entries.values()];
    return { maxDecodedImages: this.#max, decodedImages: entries.filter(entry => entry.decoded).length,
      pendingImages: entries.filter(entry => !entry.decoded).length,
      pinnedImages: entries.filter(entry => entry.references > 0).length,
      hits: this.#hits, misses: this.#misses, evictions: this.#evictions };
  }

  async acquire(source: string): Promise<ImageLease | undefined> {
    let entry = this.#entries.get(source);
    if (entry) {
      this.#hits++;
      this.#entries.delete(source);
      this.#entries.set(source, entry);
    } else {
      this.#misses++;
      const image = document.createElement("img");
      image.src = source;
      entry = { image, references: 0, decoded: false, loaded: Promise.resolve(false) };
      const created = entry;
      entry.loaded = image.decode().then(() => {
        created.decoded = true;
        this.#trim();
        return true;
      }, () => {
        this.#entries.delete(source);
        image.src = "";
        return false;
      });
      this.#entries.set(source, entry);
    }
    entry.references++;
    if (!await entry.loaded) { entry.references--; return undefined; }
    let released = false;
    const leased = entry;
    return { image: entry.image, release: () => {
      if (released) return;
      released = true;
      leased.references--;
      this.#trim();
    } };
  }

  async prefetch(source: string): Promise<void> {
    const lease = await this.acquire(source);
    lease?.release();
  }

  /** Release only unused images; displayed images are still owned by their leases. */
  clearUnused(): void {
    for (const [source, entry] of this.#entries) {
      if (entry.decoded && entry.references === 0) this.#evict(source, entry);
    }
  }

  #trim(): void {
    let count = [...this.#entries.values()].filter(entry => entry.decoded).length;
    for (const [source, entry] of this.#entries) {
      if (count <= this.#max) break;
      if (entry.decoded && entry.references === 0) { this.#evict(source, entry); count--; }
    }
  }

  #evict(source: string, entry: CacheEntry): void {
    this.#entries.delete(source);
    entry.image.src = "";
    this.#evictions++;
  }
}
