import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDbItemStore } from "../src/providers/db";
import { DB_NAME } from "../src/config";
import type { PickItem } from "../src/logic/picks";
import type { StorageItem } from "../src/logic/store";

const pick: PickItem = { barcode: "0036000291452", qty: 3, addedAt: "2026-08-11T15:00:00.000Z" };

/** Create a v1 database (items store only) containing one item, then close it. */
function seedV1Database(item: StorageItem): Promise<void> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("items", { keyPath: "barcode" });
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction("items", "readwrite");
      tx.objectStore("items").put(item);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    r.onerror = () => reject(r.error);
  });
}

describe("IndexedDbItemStore picks", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it("returns undefined for a pick never stored", async () => {
    const db = new IndexedDbItemStore();
    expect(await db.getPick("0000000000000")).toBeUndefined();
  });

  it("round-trips a pick", async () => {
    const db = new IndexedDbItemStore();
    await db.putPick(pick);
    expect(await db.getPick(pick.barcode)).toEqual(pick);
  });

  it("overwrites qty on re-add of the same barcode", async () => {
    const db = new IndexedDbItemStore();
    await db.putPick(pick);
    await db.putPick({ ...pick, qty: 7 });
    expect((await db.getPick(pick.barcode))?.qty).toBe(7);
    expect(await db.allPicks()).toHaveLength(1);
  });

  it("removes a pick", async () => {
    const db = new IndexedDbItemStore();
    await db.putPick(pick);
    await db.removePick(pick.barcode);
    expect(await db.getPick(pick.barcode)).toBeUndefined();
  });

  it("upgrades a v1 database in place, preserving existing items", async () => {
    const legacyItem: StorageItem = { barcode: "4006381333931", name: "Pens", addedAt: "2026-08-11T09:00:00.000Z" };
    await seedV1Database(legacyItem);
    const db = new IndexedDbItemStore(); // opens at v2, must migrate
    expect(await db.get(legacyItem.barcode)).toEqual(legacyItem); // survived
    await db.putPick(pick); // new store usable
    expect(await db.allPicks()).toHaveLength(1);
  });
});
