import { DB_NAME, DB_STORE, DB_STORE_PICKS, DB_VERSION } from "../config";
import type { PickItem } from "../logic/picks";
import type { StorageItem } from "../logic/store";

export interface ItemStore {
  get(barcode: string): Promise<StorageItem | undefined>;
  put(item: StorageItem): Promise<void>;
  remove(barcode: string): Promise<void>;
  all(): Promise<StorageItem[]>;
}

export interface PickStore {
  getPick(barcode: string): Promise<PickItem | undefined>;
  putPick(item: PickItem): Promise<void>;
  removePick(barcode: string): Promise<void>;
  allPicks(): Promise<PickItem[]>;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB request failed"));
  });
}

export class IndexedDbItemStore implements ItemStore, PickStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const openReq = indexedDB.open(DB_NAME, DB_VERSION);
        openReq.onupgradeneeded = () => {
          // Guarded creation: upgrades a v1 database in place without touching
          // existing data, and builds both stores on a fresh install.
          const db = openReq.result;
          if (!db.objectStoreNames.contains(DB_STORE)) {
            db.createObjectStore(DB_STORE, { keyPath: "barcode" });
          }
          if (!db.objectStoreNames.contains(DB_STORE_PICKS)) {
            db.createObjectStore(DB_STORE_PICKS, { keyPath: "barcode" });
          }
        };
        openReq.onsuccess = () => resolve(openReq.result);
        openReq.onerror = () => reject(openReq.error ?? new Error("IndexedDB open failed"));
      });
    }
    return this.dbPromise;
  }

  private async store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.open();
    return db.transaction(name, mode).objectStore(name);
  }

  async get(barcode: string): Promise<StorageItem | undefined> {
    return req((await this.store(DB_STORE, "readonly")).get(barcode)) as Promise<StorageItem | undefined>;
  }

  async put(item: StorageItem): Promise<void> {
    await req((await this.store(DB_STORE, "readwrite")).put(item));
  }

  async remove(barcode: string): Promise<void> {
    await req((await this.store(DB_STORE, "readwrite")).delete(barcode));
  }

  async all(): Promise<StorageItem[]> {
    return req((await this.store(DB_STORE, "readonly")).getAll()) as Promise<StorageItem[]>;
  }

  async getPick(barcode: string): Promise<PickItem | undefined> {
    return req((await this.store(DB_STORE_PICKS, "readonly")).get(barcode)) as Promise<PickItem | undefined>;
  }

  async putPick(item: PickItem): Promise<void> {
    await req((await this.store(DB_STORE_PICKS, "readwrite")).put(item));
  }

  async removePick(barcode: string): Promise<void> {
    await req((await this.store(DB_STORE_PICKS, "readwrite")).delete(barcode));
  }

  async allPicks(): Promise<PickItem[]> {
    return req((await this.store(DB_STORE_PICKS, "readonly")).getAll()) as Promise<PickItem[]>;
  }
}
