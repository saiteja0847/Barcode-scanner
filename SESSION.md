# Session — 2026-08-11

## Done
- Spec + plan (docs/superpowers/).
- v1 built and deployed: https://saiteja0847.github.io/Barcode-scanner/
- All 13 plan tasks committed; tests green (`npm test`, 36 tests); offline precache
  verified including the zxing wasm; live deploy verified serving the real UI + sw.js.
- Phone spike passed (user: 3/3 real barcodes decoded via camera on iPhone).

## Works
- Storage/Store scan modes, 3s cooldown, normalization (UPC-A/E→GTIN-13, EAN-8
  kept distinct), list view (search/rename/two-tap delete), IndexedDB persistence,
  PWA offline install (SW activated, wasm precached — verified in browser).

## Next step
- User acceptance on the real iPhone: install to home screen, run the
  airplane-mode checklist (scan both modes offline, restart phone, list intact).
- v1.1 candidates: export/backup of the list; undo after remove.

## Notes for future sessions
- Deploys: push to main → GitHub Actions → Pages (Pages was enabled via
  `gh api .../pages -X POST -f build_type=workflow`; workflow's auto-enable failed once).
- `zxing-wasm` is pinned EXACTLY to 3.1.1 to match barcode-detector's pin —
  a range here can re-split the dependency tree and silently break offline wasm.
- `.claude/launch.json` is gitignored (machine-specific absolute node path;
  the in-app preview launcher couldn't resolve PATH — use Bash `npm run dev` instead).
