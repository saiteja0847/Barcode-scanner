import type { ItemStore, PickStore } from "../providers/db";

export async function renderBring(db: ItemStore & PickStore): Promise<void> {
  const [picks, items] = await Promise.all([db.allPicks(), db.all()]);
  const names = new Map(items.map((i) => [i.barcode, i.name]));
  picks.sort((a, b) => b.addedAt.localeCompare(a.addedAt));

  const ul = document.getElementById("bring-items")!;
  ul.innerHTML = "";
  document.getElementById("bring-count")!.textContent = `${picks.length} to bring`;

  if (picks.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nothing to bring. In STORE mode, scan a product that's in the back and tap 'Bring to shelf…'.";
    ul.append(li);
    return;
  }

  for (const p of picks) {
    const li = document.createElement("li");
    const label = document.createElement("div");
    label.className = "item-label";
    label.textContent = `${names.get(p.barcode) ?? p.barcode}  ×${p.qty}`;
    const meta = document.createElement("div");
    meta.className = "item-meta";
    meta.textContent = p.barcode;
    const done = document.createElement("button");
    done.textContent = "Done";
    done.className = "row-btn";
    done.onclick = () => {
      void db.removePick(p.barcode).then(() => renderBring(db));
    };
    li.append(label, meta, done);
    ul.append(li);
  }
}
