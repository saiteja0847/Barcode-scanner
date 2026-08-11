# Session — 2026-08-11 (updated after v1.1)

## Done
- v1 shipped and field-tested by user (scanning works on the store iPhone).
- Keyboard bug fixed: iOS left the header scrolled off-screen after the name
  sheet closed → blur + double `scrollTo(0,0)` in `hideOverlay()`.
- v1.1 bring-to-shelf picklist shipped: "Bring to shelf…" + qty stepper on
  in-storage results (Store mode), "Bring (N)" header view with Done-tap rows,
  `picks` object store, DB v1→v2 in-place migration (test-covered, and
  exercised live in a real browser). 46 tests green. Deploy verified live.

## Works
- Both modes, cooldown, normalization, list view, bring list, offline PWA.

## Next step
- User verifies on phone: (1) header stays after saving a name, (2) bring flow
  end-to-end, (3) existing storage items intact after the auto-update.
- v1.2 candidates: list export/backup (top priority — protects against icon
  deletion), undo-after-remove.

## Notes for future sessions
- DB is now VERSION 2 (stores: items, picks). Any schema change bumps version
  with guarded store creation; always add a migration test first.
- `zxing-wasm` pinned exactly to 3.1.1 (must match barcode-detector's pin).
- Package installs are user-run — hand over commands, never run them.
- Deploys: push to main → Actions → Pages. Qty input is a stepper on purpose:
  avoids reopening the iOS keyboard problem.

## 2026-08-11 later
- Overlay flow fix shipped: tap anywhere dismisses result overlays instantly;
  qty stepper gained a Cancel (was a trap: no exit without adding). Verified
  via module-level browser test; deployed green.
