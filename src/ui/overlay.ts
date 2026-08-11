export type FlashKind = "green" | "red" | "gray";

const COLORS: Record<FlashKind, string> = {
  green: "rgba(22, 163, 74, 0.93)",
  red: "rgba(220, 38, 38, 0.93)",
  gray: "rgba(75, 85, 99, 0.93)",
};

export interface OverlayActions {
  onSaveName?: (name: string) => void;
  onRemove?: () => void;
}

let hideTimer: number | null = null;
let nameSheetOpen = false;

export function isNameSheetOpen(): boolean {
  return nameSheetOpen;
}

export function hideOverlay(): void {
  nameSheetOpen = false;
  const el = document.getElementById("overlay")!;
  el.classList.remove("visible");
  el.innerHTML = "";
}

export function showResult(kind: FlashKind, title: string, subtitle: string, actions: OverlayActions = {}): void {
  const el = document.getElementById("overlay")!;
  el.style.background = COLORS[kind];
  el.innerHTML = "";

  const h = document.createElement("div");
  h.className = "overlay-title";
  h.textContent = title;
  const sub = document.createElement("div");
  sub.className = "overlay-sub";
  sub.textContent = subtitle;
  el.append(h, sub);

  nameSheetOpen = Boolean(actions.onSaveName);
  if (actions.onSaveName) {
    const row = document.createElement("div");
    row.className = "overlay-row";
    const input = document.createElement("input");
    input.placeholder = "Product name (optional)";
    input.className = "name-input";
    const save = document.createElement("button");
    save.textContent = "Save name";
    save.className = "overlay-btn";
    save.onclick = () => {
      const v = input.value.trim();
      if (v) actions.onSaveName!(v);
      hideOverlay();
    };
    const skip = document.createElement("button");
    skip.textContent = "Skip";
    skip.className = "overlay-btn secondary";
    skip.onclick = hideOverlay;
    row.append(input, save, skip);
    el.append(row);
  }
  if (actions.onRemove) {
    const rm = document.createElement("button");
    rm.textContent = "Remove from storage list";
    rm.className = "overlay-btn secondary";
    rm.onclick = () => {
      actions.onRemove!();
      hideOverlay();
    };
    el.append(rm);
  }

  el.classList.add("visible");
  if (hideTimer !== null) clearTimeout(hideTimer);
  if (!nameSheetOpen) {
    hideTimer = window.setTimeout(hideOverlay, actions.onRemove ? 4000 : 1600);
  }
}
