import { SCAN_COOLDOWN_MS } from "../config";
import { ScanGate } from "../logic/gate";
import { normalizeBarcode } from "../logic/normalize";
import { decideStorageScan, decideStoreScan } from "../logic/store";
import { IndexedDbItemStore } from "../providers/db";
import { BrowserScanner } from "../providers/scanner.browser";
import { ScannerStartError, type ScanResult } from "../providers/scanner";
import { beep, initAudio } from "./audio";
import { isNameSheetOpen, showResult } from "./overlay";

type Mode = "storage" | "store";

const db = new IndexedDbItemStore();
const gate = new ScanGate(SCAN_COOLDOWN_MS);
const scanner = new BrowserScanner();
let mode: Mode = "store";
let busy = false;

function setMode(next: Mode): void {
  mode = next;
  document.getElementById("btn-storage")!.classList.toggle("active", next === "storage");
  document.getElementById("btn-store")!.classList.toggle("active", next === "store");
  document.getElementById("mode-hint")!.textContent =
    next === "storage"
      ? "Back room: scanning items INTO the storage list"
      : "Shelf: checking products against the storage list";
}

function showDbError(e: unknown): void {
  beep.error();
  showResult("red", "SAVE FAILED", e instanceof Error ? e.message : String(e));
}

async function refreshCount(): Promise<void> {
  const n = (await db.all()).length;
  document.getElementById("btn-list")!.textContent = `List (${n})`;
}

async function handleDecode(results: ScanResult[]): Promise<void> {
  if (busy || isNameSheetOpen()) return;
  const first = results.find((r) => {
    const code = normalizeBarcode(r.rawValue, r.format);
    return code !== null && gate.shouldProcess(code, Date.now());
  });
  if (!first) return;
  const code = normalizeBarcode(first.rawValue, first.format)!;
  busy = true;
  try {
    const existing = await db.get(code);
    if (mode === "storage") {
      const d = decideStorageScan(existing, code, new Date().toISOString());
      if (d.action === "add") {
        await db.put(d.item);
        beep.added();
        showResult("green", "ADDED ✓", code, {
          onSaveName: (name) => {
            void db.put({ ...d.item, name }).catch(showDbError);
          },
        });
      } else {
        beep.exists();
        showResult("gray", "Already in storage", d.item.name ?? code);
      }
    } else {
      const res = decideStoreScan(existing);
      if (res.inStorage) {
        beep.inStorage();
        showResult("green", "IN THE BACK ✓", res.item.name ?? code, {
          onRemove: () => {
            void db.remove(code).then(refreshCount).catch(showDbError);
          },
        });
      } else {
        beep.notInStorage();
        showResult("red", "NOT IN STORAGE ✗", code);
      }
    }
    await refreshCount();
  } catch (e) {
    showDbError(e);
  } finally {
    busy = false;
  }
}

async function requestWakeLock(): Promise<void> {
  try {
    await navigator.wakeLock?.request("screen");
  } catch {
    // not supported or denied — non-fatal
  }
}

async function startScanner(): Promise<void> {
  const video = document.getElementById("video") as HTMLVideoElement;
  const errEl = document.getElementById("scan-error")!;
  try {
    await scanner.start(video, (rs) => void handleDecode(rs));
    errEl.textContent = "";
  } catch (e) {
    if (e instanceof ScannerStartError && e.kind === "permission-denied") {
      errEl.textContent =
        "Camera access is blocked.\n\nOpen iOS Settings, find this app (or Safari), and set Camera to Allow. Then close and reopen the app.";
    } else if (e instanceof ScannerStartError && e.kind === "insecure-context") {
      errEl.textContent = "This page must be opened over HTTPS for the camera to work.";
    } else {
      errEl.textContent = `Camera unavailable: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}

function wireUi(): void {
  document.getElementById("btn-storage")!.onclick = () => {
    initAudio();
    setMode("storage");
  };
  document.getElementById("btn-store")!.onclick = () => {
    initAudio();
    setMode("store");
  };
  document.getElementById("btn-list")!.onclick = () => {
    initAudio();
    void import("./list").then(({ renderList }) => renderList(db));
    document.getElementById("view-list")!.classList.add("visible");
  };
  document.getElementById("btn-close-list")!.onclick = () => {
    document.getElementById("view-list")!.classList.remove("visible");
    void refreshCount();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void requestWakeLock();
  });
}

async function main(): Promise<void> {
  wireUi();
  setMode("store");
  await refreshCount();
  await requestWakeLock();
  await startScanner();
}

void main();
