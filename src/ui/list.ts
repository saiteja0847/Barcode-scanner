import type { ItemStore } from "../providers/db";
import type { StorageItem } from "../logic/store";

let pendingDelete: string | null = null;

export async function renderList(db: ItemStore): Promise<void> {
  const items = (await db.all()).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const search = document.getElementById("search") as HTMLInputElement;
  search.oninput = () => draw(db, items, search.value);
  draw(db, items, search.value);
}

function draw(db: ItemStore, items: StorageItem[], query: string): void {
  const q = query.trim().toLowerCase();
  const ul = document.getElementById("items")!;
  ul.innerHTML = "";
  const filtered = q
    ? items.filter((i) => i.barcode.toLowerCase().includes(q) || (i.name ?? "").toLowerCase().includes(q))
    : items;
  document.getElementById("list-count")!.textContent = `${filtered.length} of ${items.length} items`;
  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nothing in storage yet. Switch to STORAGE mode and scan items in the back room.";
    ul.append(li);
    return;
  }
  for (const item of filtered) ul.append(row(db, item));
}

function row(db: ItemStore, item: StorageItem): HTMLLIElement {
  const li = document.createElement("li");
  const label = document.createElement("div");
  label.className = "item-label";
  label.textContent = item.name ?? item.barcode;
  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.textContent = `${item.barcode} · added ${item.addedAt.slice(0, 10)}`;

  const rename = document.createElement("button");
  rename.textContent = item.name ? "Rename" : "Name";
  rename.className = "row-btn";
  rename.onclick = () => {
    rename.remove();
    const input = document.createElement("input");
    input.value = item.name ?? "";
    input.className = "name-input";
    const save = document.createElement("button");
    save.textContent = "Save";
    save.className = "row-btn";
    save.onclick = () => {
      const name = input.value.trim();
      const updated: StorageItem = name
        ? { ...item, name }
        : { barcode: item.barcode, addedAt: item.addedAt };
      void db.put(updated).then(() => renderList(db));
    };
    li.append(input, save);
    input.focus();
  };

  const del = document.createElement("button");
  del.textContent = "Delete";
  del.className = "row-btn danger";
  del.onclick = () => {
    if (pendingDelete === item.barcode) {
      pendingDelete = null;
      void db.remove(item.barcode).then(() => renderList(db));
    } else {
      pendingDelete = item.barcode;
      del.textContent = "Really delete?";
    }
  };

  li.append(label, meta, rename, del);
  return li;
}
