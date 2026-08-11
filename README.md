# Storage Checker

Offline iPhone web app for a small store: scan a product barcode and instantly know
whether it's in the back-room storage.

- **Live app:** https://saiteja0847.github.io/Barcode-scanner/
- **Scanner diagnostic page:** https://saiteja0847.github.io/Barcode-scanner/spike.html
- **Spec:** docs/superpowers/specs/2026-08-11-barcode-scanner-design.md

## Install on the phone (once, on any internet connection)

1. Open the live app URL in Safari.
2. Share → **Add to Home Screen**.
3. Open it from the home screen, allow camera. Done — works fully offline from now on.

## Modes

- **STORAGE** (blue): in the back room — scanning adds unknown products to the list.
- **STORE** (amber): at the shelf — scanning answers IN THE BACK ✓ / NOT IN STORAGE ✗.
- **List**: browse, search, rename, delete.

## Development

    npm install
    npm test          # vitest: logic + providers
    npm run dev       # local dev server
    npm run build     # typecheck + production build to dist/

Deploys automatically to GitHub Pages on push to main.
