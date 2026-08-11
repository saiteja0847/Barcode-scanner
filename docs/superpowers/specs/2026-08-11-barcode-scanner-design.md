# Store Storage Checker — Design Spec

**Date:** 2026-08-11
**Status:** Approved pending user review
**Target:** iPhone-only, fully offline, single device

## Problem

A small store keeps extra inventory of its best sellers in a back storage room. When a
shelf runs low, a worker (often new) has no way to know whether the missing product is
available in the back without physically searching for it. Wasted trips and unfilled
shelves result. Store Wi-Fi is unreliable, so the tool must not depend on a network.

## Decisions (from brainstorming, 2026-08-11)

| Decision | Choice | Rationale |
|---|---|---|
| Devices | One iPhone | Single device does both modes; zero sync; fully offline |
| Tracking | Presence only (yes/no) | Fast scan flow; counts would drift stale immediately |
| Labeling | Optional skippable name on first add | Human-readable list without slowing scanning |
| Platform | Home-screen web app (PWA) | No App Store, no $99/yr, no 7-day sideload expiry; install by link once, offline forever after |
| Fallback | Native iOS (SwiftUI + VisionKit) | Only if the stage-0 scan spike fails on the real phone |

## User flows

The app is one screen: a full-screen camera viewfinder with a two-way mode toggle at
the top (**STORAGE** / **STORE**) and a list button. Scanning is continuous — no
shutter button. A decoded barcode is ignored if the same code was decoded within the
last 3 seconds (cooldown, configurable).

### Storage mode — used in the back room ("what do we have back here?")

| Scan result | App response |
|---|---|
| Barcode not in list | Add it. Green full-screen flash, banner **ADDED ✓**, optional inline name field with a prominent Skip. |
| Barcode already in list | Neutral gray flash, banner **Already in storage**. No change. |

### Store mode — used at the shelf ("is this worth a trip to the back?")

| Scan result | App response |
|---|---|
| Barcode in list | Green full-screen flash, banner **IN THE BACK ✓** plus name if known. Secondary small button: **Remove from storage list** (for "I'm taking the last one"). |
| Barcode not in list | Red full-screen flash, banner **NOT IN STORAGE ✗**. No change. |

### List view

All storage items, newest first: name (or barcode if unnamed) + date added. Search box
filters by name/barcode. Tap an item to edit its name. Swipe (or delete button) removes
it. Item count shown. Empty state explains how to add items (switch to Storage mode and
scan).

### Feedback channels (platform-corrected)

iOS Safari does **not** support the vibration API, so haptics are unavailable to web
apps. Feedback is therefore:

1. **Primary:** full-screen color flash + large-type banner (green / red / gray) —
   readable at arm's length in any noise.
2. **Secondary:** short distinct beeps per outcome via Web Audio (muted by the ring/
   silent switch — acceptable, since color is primary).

Screen Wake Lock (feature-detected, graceful no-op if absent) keeps the display on
while the camera is active.

## Data model

One entity, one table:

```
StorageItem {
  barcode: string   // canonical form — primary key
  name?: string     // optional human label
  addedAt: string   // ISO 8601, set on insert
}
```

Persistence: IndexedDB on the device. Home-screen web apps are exempt from Safari's
7-day inactive-storage eviction, and the data survives app closes and phone restarts.
Size is negligible (thousands of items < 1 MB).

### Barcode normalization (pure logic, test-first)

The same physical product can decode differently across engines/formats. Canonical
form rules, applied to every decoded value before any lookup or insert:

| Decoded format | Rule |
|---|---|
| EAN-13 (13 digits) | Keep as-is |
| UPC-A (12 digits) | Prepend `0` → 13-digit GTIN-13 |
| UPC-E (6/8 digits) | Expand to UPC-A per the standard GS1 expansion, then prepend `0` |
| EAN-8 (8 digits) | Keep as-is — **never** pad (distinct namespace from EAN-13; padding could collide) |
| Code-128 (variable) | Keep raw string (covers store-printed labels) |

Whitespace stripped. Check digits are trusted from the decoder (zxing validates them);
no re-validation in logic.

## Architecture

Static site. No backend, no accounts, no network calls at runtime.

**Stack:** Vite + vanilla TypeScript. No UI framework — one screen, one store, one
scanner; framework overhead buys nothing and costs load time on older iPhones.

```
src/
  config.ts             constants: SCAN_COOLDOWN_MS, ALLOWED_FORMATS, DB_NAME
  logic/
    normalize.ts        pure: decoded value+format → canonical barcode
    store.ts            pure: addScan / checkScan / removeItem / renameItem over a plain items map
  providers/
    scanner.ts          Scanner interface: start(videoEl, onDecode), stop()
    scanner.browser.ts  implementation: getUserMedia (rear camera) + barcode-detector
                        polyfill (zxing-wasm; uses native BarcodeDetector when available)
    db.ts               ItemStore interface + IndexedDB implementation
  ui/
    app.ts              mode state, wiring scanner→logic→db→overlays
    overlay.ts          flash/banner/name-field rendering
    list.ts             list view
public/
  manifest.webmanifest  name, icons, display: standalone, orientation: portrait
  (service worker)      precache all assets; offline-first; update on next online load
tests/                  vitest, mirrors src/ (logic fully; db via fake-indexeddb)
```

Layering rules (per global config): `logic/` has no I/O and no imports from
providers/ui. `ui/` contains no business decisions. The `Scanner` interface is the
deliberate seam for the native fallback: if browser scanning fails the spike, only
`providers/scanner.*` and thin UI are rebuilt in Swift; `logic/`, `db`, and all tests
survive.

**Detection formats** restricted to: EAN-13, EAN-8, UPC-A, UPC-E, Code-128. Fewer
formats = faster, more accurate decoding; stray QR codes are ignored by design.

**Hosting:** GitHub Pages (free, permanent HTTPS — required for camera access).
Install flow: open URL once in Safari on good internet → Share → Add to Home Screen.
After that the app runs fully offline; updates are picked up automatically the next
time the phone happens to be online.

## Edge cases & error handling

| Case | Behavior |
|---|---|
| Camera permission denied | Full-screen instructions with exact Settings path to re-enable |
| Scanner init failure (old iOS, no camera) | Visible error screen naming the problem; never a blank screen |
| IndexedDB write failure | Red error toast; success banner only ever shown **after** the write resolves |
| Rapid duplicate decodes | 3 s per-code cooldown |
| Non-retail code scanned (QR etc.) | Ignored via format allowlist |
| Same product as UPC-A vs EAN-13 | Unified by normalization (above) |
| App deleted from home screen | Data is lost — accepted for v1; export/backup is the v1.1 mitigation |
| Ring/silent switch on | Beeps muted; color flash still fully communicates |

## Testing & validation

- **Stage-0 spike (gate for everything else):** a minimal deployed page that only
  scans and displays decoded values. Acceptance: on the actual store iPhone, ≥9 of 10
  real products decode in under ~3 s each under store lighting. Fail → switch to the
  native fallback with almost nothing thrown away.
- **TDD (per global workflow):** every `logic/` function test-first with vitest —
  normalization table above becomes the parameterized test set; add/check/remove
  including empty/None/malformed inputs. `db.ts` tested against fake-indexeddb.
- **On-device verification (per global verification rule):** scanner and full flows
  verified on the real iPhone — camera hardware cannot be meaningfully unit-tested.
- **Offline acceptance test:** with the phone in Airplane Mode: launch from home
  screen, scan in both modes, restart phone, relaunch, confirm list intact.

## Success criteria

1. A worker with no training can pick the phone up, choose a mode, scan, and read the
   answer at arm's length.
2. Scan-to-answer in ~2 s per product under store lighting.
3. Entire app works in Airplane Mode, including after phone restart.
4. A product added in Storage mode is immediately reflected in Store mode checks.

## Out of scope (v1)

- Quantities / counts (presence only)
- Multi-device sync (single phone)
- Export/backup of the list (planned v1.1)
- Product name lookup from online databases (offline-first; names are typed)
- Torch/flashlight control (unsupported in iOS Safari)
- Android as a tested target (PWA will likely work there; not verified)

## Build stages (input to the implementation plan)

0. **Spike:** scan-test page deployed to GitHub Pages; run the acceptance test on the
   real iPhone. **Hard gate.**
1. Logic layer, test-first: `normalize.ts`, `store.ts`.
2. DB provider with fake-indexeddb tests.
3. UI + scanner wiring; on-device verification.
4. PWA shell: manifest, service worker, icons; Airplane-Mode acceptance test.
5. Polish + deploy + install on the store phone; list search, name editing.
