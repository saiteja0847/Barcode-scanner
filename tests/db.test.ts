import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDbItemStore } from "../src/providers/db";
import type { StorageItem } from "../src/logic/store";

const item: StorageItem = { barcode: "0036000291452", name: "Peas", addedAt: "2026-08-11T10:00:00.000Z" };

describe("IndexedDbItemStore", () => {
  beforeEach(() => {
    // fresh in-memory IndexedDB per test — no cross-test state
    globalThis.indexedDB = new IDBFactory();
  });

  it("returns undefined for a barcode never stored", async () => {
    const db = new IndexedDbItemStore();
    expect(await db.get("0000000000000")).toBeUndefined();
  });

  it("round-trips an item", async () => {
    const db = new IndexedDbItemStore();
    await db.put(item);
    expect(await db.get(item.barcode)).toEqual(item);
  });

  it("overwrites on same barcode (used by rename)", async () => {
    const db = new IndexedDbItemStore();
    await db.put(item);
    await db.put({ ...item, name: "Frozen peas" });
    expect((await db.get(item.barcode))?.name).toBe("Frozen peas");
    expect(await db.all()).toHaveLength(1);
  });

  it("removes an item", async () => {
    const db = new IndexedDbItemStore();
    await db.put(item);
    await db.remove(item.barcode);
    expect(await db.get(item.barcode)).toBeUndefined();
  });

  it("lists everything stored", async () => {
    const db = new IndexedDbItemStore();
    await db.put(item);
    await db.put({ barcode: "4006381333931", addedAt: "2026-08-11T11:00:00.000Z" });
    const all = await db.all();
    expect(all.map((i) => i.barcode).sort()).toEqual(["0036000291452", "4006381333931"]);
  });
});
