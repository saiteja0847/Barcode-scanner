import { clampQty } from "../logic/picks";

export type FlashKind = "green" | "red" | "gray";

const COLORS: Record<FlashKind, string> = {
  green: "rgba(22, 163, 74, 0.93)",
  red: "rgba(220, 38, 38, 0.93)",
  gray: "rgba(75, 85, 99, 0.93)",
};

export interface OverlayActions {
  onSaveName?: (name: string) => void;
  onRemove?: () => void;
  onBring?: (qty: number) => void;
}

let hideTimer: number | null = null;
let sheetOpen = false;

/** True while a sticky input (name box or qty stepper) is open — scanning must pause. */
export function isSheetOpen(): boolean {
  return sheetOpen;
}

export function hideOverlay(): void {
  sheetOpen = false;
  // Blur before clearing so iOS closes the keyboard, then undo the scroll
  // offset iOS applies to keep a focused input visible — in a fixed-height
  // standalone app it is not always restored and leaves the header off-screen.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  const el = document.getElementById("overlay")!;
  el.classList.remove("visible");
  el.innerHTML = "";
  window.scrollTo(0, 0);
  window.setTimeout(() => window.scrollTo(0, 0), 250);
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

  sheetOpen = Boolean(actions.onSaveName);
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
  if (actions.onBring) {
    const bringBtn = document.createElement("button");
    bringBtn.textContent = "Bring to shelf…";
    bringBtn.className = "overlay-btn";
    bringBtn.onclick = () => {
      if (hideTimer !== null) clearTimeout(hideTimer);
      sheetOpen = true; // hold the overlay (and pause scanning) while choosing
      bringBtn.remove();
      const row = document.createElement("div");
      row.className = "overlay-row";
      let qty = 1;
      const minus = document.createElement("button");
      minus.textContent = "−";
      minus.className = "overlay-btn stepper";
      const count = document.createElement("div");
      count.className = "stepper-count";
      count.textContent = "1";
      const plus = document.createElement("button");
      plus.textContent = "+";
      plus.className = "overlay-btn stepper";
      minus.onclick = () => {
        qty = clampQty(qty - 1);
        count.textContent = String(qty);
      };
      plus.onclick = () => {
        qty = clampQty(qty + 1);
        count.textContent = String(qty);
      };
      const add = document.createElement("button");
      add.textContent = "Add";
      add.className = "overlay-btn";
      add.onclick = () => {
        actions.onBring!(qty);
        hideOverlay();
      };
      const cancel = document.createElement("button");
      cancel.textContent = "Cancel";
      cancel.className = "overlay-btn secondary";
      cancel.onclick = hideOverlay;
      row.append(minus, count, plus, add, cancel);
      el.append(row);
    };
    el.append(bringBtn);
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

  if (actions.onRemove || actions.onBring) {
    const hint = document.createElement("div");
    hint.className = "overlay-hint";
    hint.textContent = "tap anywhere for next product";
    el.append(hint);
  }

  // Tap anywhere (except buttons/inputs) to dismiss immediately and keep
  // scanning — no dwell between products. Sticky sheets (name box, qty
  // stepper) are exempt so a stray tap can't discard typed input.
  el.onclick = (ev) => {
    if (sheetOpen) return;
    if (ev.target instanceof HTMLElement && ev.target.closest("button, input")) return;
    hideOverlay();
  };

  el.classList.add("visible");
  if (hideTimer !== null) clearTimeout(hideTimer);
  if (!sheetOpen) {
    hideTimer = window.setTimeout(hideOverlay, actions.onRemove || actions.onBring ? 4000 : 1600);
  }
}
