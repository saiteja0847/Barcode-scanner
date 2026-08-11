/** One row on the bring-to-shelf list. Presence in storage stays yes/no —
 *  qty is how many the SHELF needs, not how many the back room holds. */
export interface PickItem {
  barcode: string;
  qty: number;
  addedAt: string;
}

export function clampQty(n: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.min(99, Math.max(1, Math.floor(n)));
}
