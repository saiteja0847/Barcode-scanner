import type { ItemStore } from "../providers/db";

export async function renderList(db: ItemStore): Promise<void> {
  const items = await db.all();
  document.getElementById("list-count")!.textContent = `${items.length} items`;
}
