import { DB_NAME, DB_STORE } from "../config";
import type { StorageItem } from "../logic/store";

export interface ItemStore {
  get(barcode: string): Promise<StorageItem | undefined>;
  put(item: StorageItem): Promise<void>;
  remove(barcode: string): Promise<void>;
  all(): Promise<StorageItem[]>;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB request failed"));
  });
}

export class IndexedDbItemStore implements ItemStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const openReq = indexedDB.open(DB_NAME, 1);
        openReq.onupgradeneeded = () => {
          openReq.result.createObjectStore(DB_STORE, { keyPath: "barcode" });
        };
        openReq.onsuccess = () => resolve(openReq.result);
        openReq.onerror = () => reject(openReq.error ?? new Error("IndexedDB open failed"));
      });
    }
    return this.dbPromise;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.open();
    return db.transaction(DB_STORE, mode).objectStore(DB_STORE);
  }

  async get(barcode: string): Promise<StorageItem | undefined> {
    return req((await this.store("readonly")).get(barcode)) as Promise<StorageItem | undefined>;
  }

  async put(item: StorageItem): Promise<void> {
    await req((await this.store("readwrite")).put(item));
  }

  async remove(barcode: string): Promise<void> {
    await req((await this.store("readwrite")).delete(barcode));
  }

  async all(): Promise<StorageItem[]> {
    return req((await this.store("readonly")).getAll()) as Promise<StorageItem[]>;
  }
}
