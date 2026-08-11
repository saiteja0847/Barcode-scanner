export interface StorageItem {
  barcode: string;
  name?: string;
  addedAt: string;
}

export type StorageScanDecision =
  | { action: "add"; item: StorageItem }
  | { action: "exists"; item: StorageItem };

export function decideStorageScan(
  existing: StorageItem | undefined,
  barcode: string,
  nowIso: string,
): StorageScanDecision {
  if (existing) return { action: "exists", item: existing };
  return { action: "add", item: { barcode, addedAt: nowIso } };
}

export type StoreScanResult = { inStorage: true; item: StorageItem } | { inStorage: false };

export function decideStoreScan(existing: StorageItem | undefined): StoreScanResult {
  return existing ? { inStorage: true, item: existing } : { inStorage: false };
}
