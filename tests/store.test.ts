import { describe, expect, it } from "vitest";
import { decideStorageScan, decideStoreScan, StorageItem } from "../src/logic/store";

const existing: StorageItem = { barcode: "0036000291452", name: "Peas", addedAt: "2026-08-11T10:00:00.000Z" };

describe("decideStorageScan", () => {
  it("adds an unknown barcode with timestamp and no name", () => {
    const d = decideStorageScan(undefined, "4006381333931", "2026-08-11T12:00:00.000Z");
    expect(d).toEqual({
      action: "add",
      item: { barcode: "4006381333931", addedAt: "2026-08-11T12:00:00.000Z" },
    });
  });

  it("reports an existing barcode untouched (name preserved)", () => {
    const d = decideStorageScan(existing, existing.barcode, "2026-08-11T12:00:00.000Z");
    expect(d).toEqual({ action: "exists", item: existing });
  });
});

describe("decideStoreScan", () => {
  it("finds an item that is in storage", () => {
    expect(decideStoreScan(existing)).toEqual({ inStorage: true, item: existing });
  });

  it("reports a missing item", () => {
    expect(decideStoreScan(undefined)).toEqual({ inStorage: false });
  });
});
