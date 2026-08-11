# Store Storage Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An offline iPhone PWA that scans retail barcodes to build a back-room storage list (Storage mode) and instantly answer "is this in the back?" at the shelf (Store mode).

**Architecture:** Static Vite + vanilla TypeScript site, no backend. Pure logic layer (normalize / cooldown gate / decisions), providers behind interfaces (IndexedDB store, camera scanner via barcode-detector polyfill with locally-bundled zxing wasm), thin DOM UI. Deployed to GitHub Pages via Actions; installed to the phone via Add to Home Screen.

**Tech Stack:** Vite 6, TypeScript 5 (strict), Vitest 3, fake-indexeddb (tests), barcode-detector v3 + zxing-wasm v2 (scanning), vite-plugin-pwa (offline shell), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-11-barcode-scanner-design.md`

## Global Constraints

- Target: iOS Safari 16.4+; build target ES2020; portrait phone layout.
- No UI framework. Dependencies limited to exactly: `barcode-detector`, `zxing-wasm` (runtime); `vite`, `typescript`, `vitest`, `fake-indexeddb`, `vite-plugin-pwa` (dev). Anything else requires user approval.
- Barcodes are stored ONLY in canonical form from `normalizeBarcode` — never store a raw decoded value.
- Layering: `src/logic/` has zero I/O and zero DOM imports; `src/providers/` implement interfaces; `src/ui/` contains no business decisions. `config.ts` holds all constants.
- Detection formats exactly: `ean_13`, `ean_8`, `upc_a`, `upc_e`, `code_128`.
- The zxing `.wasm` binary must be bundled locally (`?url` import + `locateFile` override) — never fetched from a CDN, or the app breaks offline.
- Vite `base: "./"` (relative paths) so GitHub Pages project URLs work. All asset hrefs in HTML relative (no leading `/`).
- No absolute `/Users` paths anywhere (`grep -r "/Users" src/ scripts/` must return nothing; the icon script derives paths from `Path(__file__)`).
- Commit after every task: `<type>: <what>` (feat|fix|refactor|test|chore|docs).
- Constants: `SCAN_COOLDOWN_MS = 3000`, `DETECT_INTERVAL_MS = 150`, `DB_NAME = "storage-checker"`, `DB_STORE = "items"`.
- **HARD GATE after Task 4:** Tasks 5–8 (pure logic + db) may proceed while awaiting spike results — they survive a native pivot by design. Tasks 9–12 (UI/PWA on browser scanning) require the user-reported spike result: ≥9/10 real products decode in <3 s each on the actual iPhone.

---

### Task 1: Project scaffold + scanner dependency validation

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/config.ts`, `tests/scanner-deps.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `src/config.ts` exporting `SCAN_COOLDOWN_MS: number`, `DETECT_INTERVAL_MS: number`, `ALLOWED_FORMATS: readonly ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]`, `DB_NAME: string`, `DB_STORE: string`. A working `npm test` / `npm run build` toolchain every later task relies on.

- [ ] **Step 1: Write config files**

`package.json`:

```json
{
  "name": "store-storage-checker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "barcode-detector": "^3.0.0",
    "zxing-wasm": "^2.0.0"
  },
  "devDependencies": {
    "fake-indexeddb": "^6.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vite-plugin-pwa": "^0.21.0",
    "vitest": "^3.0.0"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    rollupOptions: {
      input: {
        main: "index.html",
        spike: "spike.html",
      },
    },
  },
});
```

Note: `spike.html` is created in Task 3. Until then, keep `rollupOptions.input` with only `main: "index.html"` and add the `spike` line in Task 3.

`index.html` (placeholder until Task 10):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Storage Checker</title>
</head>
<body>
  <p>Storage Checker — under construction. Spike page: <a href="spike.html">spike.html</a></p>
</body>
</html>
```

`src/config.ts`:

```ts
export const SCAN_COOLDOWN_MS = 3000;
export const DETECT_INTERVAL_MS = 150;
export const ALLOWED_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] as const;
export const DB_NAME = "storage-checker";
export const DB_STORE = "items";
```

Append to `.gitignore` (keep existing lines):

```
node_modules/
dist/
.DS_Store
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: completes without errors. Then run `npm ls zxing-wasm` — expected: a single version of `zxing-wasm` appears (deduped under `barcode-detector`), no version conflict warning. If two different major versions appear, align the direct `zxing-wasm` range with the one `barcode-detector` requires — do NOT add more packages.

- [ ] **Step 3: Write the dependency contract test (this is the /validate step for the scanner stack)**

`tests/scanner-deps.test.ts`:

```ts
import { expect, it } from "vitest";
import { BarcodeDetector } from "barcode-detector/ponyfill";
import { prepareZXingModule } from "zxing-wasm/reader";
import { ALLOWED_FORMATS } from "../src/config";

it("scanner deps expose the API the app is built on", async () => {
  expect(typeof prepareZXingModule).toBe("function");
  expect(typeof BarcodeDetector).toBe("function");
  const formats = await BarcodeDetector.getSupportedFormats();
  for (const f of ALLOWED_FORMATS) expect(formats).toContain(f);
});
```

- [ ] **Step 4: Run the contract test**

Run: `npm test`
Expected: PASS (1 test). If an import path fails (e.g., no `barcode-detector/ponyfill` export), STOP — document the actual export surface from `node_modules/barcode-detector/package.json` `exports` field, adjust the import in both this test and (later) `scanner.browser.ts`, and note the actual behavior in the commit message. Do not add packages.

- [ ] **Step 5: Verify build works**

Run: `npm run build`
Expected: `tsc` silent, Vite writes `dist/` with `index.html`. 

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite+ts project with validated scanner deps"
```

---

### Task 2: EAN-13 test-pattern generator (pure logic, TDD)

Purpose: lets the spike page prove the whole wasm decode pipeline works by decoding a barcode we draw ourselves — no camera needed. Also our only way to verify scanning headlessly in a desktop browser.

**Files:**
- Create: `src/logic/ean13.ts`, `tests/ean13.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `ean13Modules(code: string): string` (95-char string of "0"/"1" modules; throws `Error` on non-13-digit input). Task 3 consumes it via `drawEan13`.

- [ ] **Step 1: Write the failing test**

`tests/ean13.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ean13Modules } from "../src/logic/ean13";

describe("ean13Modules", () => {
  it("produces 95 modules with guard patterns", () => {
    const m = ean13Modules("4006381333931");
    expect(m).toHaveLength(95);
    expect(m.startsWith("101")).toBe(true);
    expect(m.endsWith("101")).toBe(true);
    expect(m.slice(45, 50)).toBe("01010");
  });

  it("encodes the digit 0 in L-code at the first position for a 0-led code", () => {
    // First digit 0 => parity LLLLLL; second digit 0 => L-code of 0 = 0001101
    const m = ean13Modules("0036000291452");
    expect(m.slice(3, 10)).toBe("0001101");
  });

  it("throws on malformed input", () => {
    expect(() => ean13Modules("")).toThrow();
    expect(() => ean13Modules("123")).toThrow();
    expect(() => ean13Modules("400638133393a")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/logic/ean13'`

- [ ] **Step 3: Write the implementation**

`src/logic/ean13.ts`:

```ts
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = L.map((p) => p.split("").map((b) => (b === "0" ? "1" : "0")).join(""));
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function ean13Modules(code: string): string {
  if (!/^[0-9]{13}$/.test(code)) throw new Error("EAN-13 requires exactly 13 digits");
  const digits = code.split("").map(Number);
  const parity = PARITY[digits[0]!]!;
  let m = "101";
  for (let i = 1; i <= 6; i++) m += (parity[i - 1] === "L" ? L : G)[digits[i]!]!;
  m += "01010";
  for (let i = 7; i <= 12; i++) m += R[digits[i]!]!;
  return m + "101";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add tests/ean13.test.ts src/logic/ean13.ts
git commit -m "feat: add EAN-13 test-pattern generator"
```

---

### Task 3: Scanner provider + spike page

**Files:**
- Create: `src/providers/scanner.ts`, `src/providers/scanner.browser.ts`, `src/ui/spike-draw.ts`, `src/spike.ts`, `spike.html`
- Modify: `vite.config.ts` (add `spike` input, see Task 1 Step 1 note)

**Interfaces:**
- Consumes: `ean13Modules` (Task 2), `ALLOWED_FORMATS`, `DETECT_INTERVAL_MS` (Task 1)
- Produces:
  - `interface ScanResult { rawValue: string; format: string }`
  - `type ScannerErrorKind = "permission-denied" | "no-camera" | "insecure-context" | "unknown"`
  - `class ScannerStartError extends Error { kind: ScannerErrorKind }`
  - `interface Scanner { start(video: HTMLVideoElement, onDecode: (results: ScanResult[]) => void): Promise<void>; stop(): void }`
  - `class BrowserScanner implements Scanner`
  - `drawEan13(code: string): HTMLCanvasElement`
  - Task 10 consumes `BrowserScanner`, `ScannerStartError`, `ScanResult`.

- [ ] **Step 1: Write the scanner interface**

`src/providers/scanner.ts`:

```ts
export interface ScanResult {
  rawValue: string;
  format: string;
}

export type ScannerErrorKind = "permission-denied" | "no-camera" | "insecure-context" | "unknown";

export class ScannerStartError extends Error {
  constructor(
    public readonly kind: ScannerErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ScannerStartError";
  }
}

export interface Scanner {
  start(video: HTMLVideoElement, onDecode: (results: ScanResult[]) => void): Promise<void>;
  stop(): void;
}
```

- [ ] **Step 2: Write the browser implementation (wasm bundled locally — offline constraint)**

`src/providers/scanner.browser.ts`:

```ts
import { BarcodeDetector } from "barcode-detector/ponyfill";
import { prepareZXingModule } from "zxing-wasm/reader";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import { ALLOWED_FORMATS, DETECT_INTERVAL_MS } from "../config";
import { Scanner, ScanResult, ScannerStartError } from "./scanner";

// Serve the wasm from our own origin so the app works with no network.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
  },
});

export class BrowserScanner implements Scanner {
  private stream: MediaStream | null = null;
  private timer: number | null = null;

  async start(video: HTMLVideoElement, onDecode: (results: ScanResult[]) => void): Promise<void> {
    if (!window.isSecureContext) {
      throw new ScannerStartError("insecure-context", "Camera requires HTTPS");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new ScannerStartError("no-camera", "Camera API not available in this browser");
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        throw new ScannerStartError("permission-denied", e.message);
      }
      if (e instanceof DOMException && (e.name === "NotFoundError" || e.name === "OverconstrainedError")) {
        throw new ScannerStartError("no-camera", e.message);
      }
      throw new ScannerStartError("unknown", String(e));
    }
    video.srcObject = this.stream;
    await video.play();

    const detector = new BarcodeDetector({
      formats: [...ALLOWED_FORMATS] as ConstructorParameters<typeof BarcodeDetector>[0] extends { formats?: infer F } ? F : never,
    });
    let busy = false;
    this.timer = window.setInterval(() => {
      if (busy || video.readyState < 2) return;
      busy = true;
      void detector
        .detect(video)
        .then((found) => {
          if (found.length > 0) {
            onDecode(found.map((b) => ({ rawValue: b.rawValue, format: b.format })));
          }
        })
        .catch(() => {
          // one failed frame is not fatal; keep scanning
        })
        .finally(() => {
          busy = false;
        });
    }, DETECT_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
```

If the conditional-type trick for `formats` fails to compile, replace with the simpler form the package's types accept, e.g. `new BarcodeDetector({ formats: [...ALLOWED_FORMATS] as import("barcode-detector/ponyfill").BarcodeFormat[] })` — check the actual exported type name in `node_modules/barcode-detector/dist/` and use it. Document what you found in the commit message.

- [ ] **Step 3: Write the canvas renderer for the self-test**

`src/ui/spike-draw.ts`:

```ts
import { ean13Modules } from "../logic/ean13";

export function drawEan13(code: string): HTMLCanvasElement {
  const modules = ean13Modules(code);
  const scale = 4;
  const quiet = 12; // quiet zone in modules on each side
  const height = 120;
  const canvas = document.createElement("canvas");
  canvas.width = (modules.length + quiet * 2) * scale;
  canvas.height = height + 40;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === "1") ctx.fillRect((quiet + i) * scale, 20, scale, height);
  }
  return canvas;
}
```

- [ ] **Step 4: Write the spike page**

`spike.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Scan Spike</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; margin: 0; background: #111; color: #eee; }
    #selftest { padding: 10px 14px; font-weight: 600; }
    #selftest.pass { color: #4ade80; }
    #selftest.fail { color: #f87171; }
    video { display: block; width: 100%; max-height: 55vh; background: #000; }
    #err { color: #f87171; padding: 12px 14px; white-space: pre-wrap; }
    ul { margin: 0; padding: 10px 14px; list-style: none; font-size: 18px; }
    li { padding: 8px 0; border-bottom: 1px solid #333; }
  </style>
</head>
<body>
  <div id="selftest">Self-test: running…</div>
  <video id="video" playsinline muted autoplay></video>
  <div id="err"></div>
  <ul id="log"></ul>
  <script type="module" src="src/spike.ts"></script>
</body>
</html>
```

`src/spike.ts`:

```ts
import { BarcodeDetector } from "barcode-detector/ponyfill";
import { BrowserScanner } from "./providers/scanner.browser";
import { ScannerStartError } from "./providers/scanner";
import { drawEan13 } from "./ui/spike-draw";

const KNOWN_EAN = "4006381333931";

async function selfTest(): Promise<void> {
  const el = document.getElementById("selftest")!;
  try {
    const canvas = drawEan13(KNOWN_EAN);
    const detector = new BarcodeDetector({ formats: ["ean_13"] });
    const found = await detector.detect(canvas);
    const ok = found.some((b) => b.rawValue === KNOWN_EAN);
    el.textContent = ok
      ? `Self-test: PASS — decoded ${KNOWN_EAN} from a drawn barcode`
      : `Self-test: FAIL — detected ${JSON.stringify(found.map((f) => f.rawValue))}`;
    el.className = ok ? "pass" : "fail";
  } catch (e) {
    el.textContent = `Self-test: FAIL — ${String(e)}`;
    el.className = "fail";
  }
}

function logDecode(rawValue: string, format: string): void {
  const log = document.getElementById("log")!;
  const li = document.createElement("li");
  li.textContent = `${new Date().toLocaleTimeString()}  [${format}]  ${rawValue}`;
  log.prepend(li);
  while (log.children.length > 30) log.lastElementChild!.remove();
}

async function main(): Promise<void> {
  await selfTest();
  const video = document.getElementById("video") as HTMLVideoElement;
  const seen = new Map<string, number>();
  const scanner = new BrowserScanner();
  try {
    await scanner.start(video, (results) => {
      for (const r of results) {
        const now = Date.now();
        if (now - (seen.get(r.rawValue) ?? 0) > 1500) {
          seen.set(r.rawValue, now);
          logDecode(r.rawValue, r.format);
        }
      }
    });
  } catch (e) {
    document.getElementById("err")!.textContent =
      e instanceof ScannerStartError
        ? `Camera error (${e.kind}): ${e.message}\nCamera scanning needs a real device — the self-test above still validates decoding.`
        : `Unexpected: ${String(e)}`;
  }
}

void main();
```

Also update `vite.config.ts` `rollupOptions.input` to include `spike: "spike.html"`.

- [ ] **Step 5: Verify build + run in a desktop browser**

Run: `npm run build`
Expected: succeeds; `dist/` contains `spike.html` and a `.wasm` asset (check: `ls dist/assets | grep -i wasm` → one `zxing_reader-*.wasm` file).

Run: `npm run dev`, open `http://localhost:5173/spike.html` in a browser.
Expected: **"Self-test: PASS — decoded 4006381333931 from a drawn barcode"** in green. Camera section may show a camera error on a machine without camera permission — that error must be the styled message, never a blank page. This step is the make-or-break check that the wasm decode pipeline works at all.

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: PASS (deps contract + ean13 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add browser scanner provider and spike page"
```

---

### Task 4: GitHub Pages deploy (spike goes live)

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: build toolchain (Task 1), spike page (Task 3)
- Produces: live URL `https://saiteja0847.github.io/Barcode-scanner/spike.html` — the artifact the user tests on the real iPhone (THE GATE). Task 13 reuses the same pipeline.

- [ ] **Step 1: Write the workflow**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
        with:
          enablement: true
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Create the GitHub repo and push** (requires the user's prior OK for a public repo)

```bash
git branch -M main
git add .github/workflows/deploy.yml
git commit -m "chore: add GitHub Pages deploy workflow"
gh repo create Barcode-scanner --public --source . --push
```

Expected: repo created at `saiteja0847/Barcode-scanner`, push succeeds, workflow starts.

- [ ] **Step 3: Verify the deploy**

Run: `gh run watch --exit-status` (or poll `gh run list --limit 1`)
Expected: workflow concludes `success`.

Then fetch `https://saiteja0847.github.io/Barcode-scanner/spike.html`
Expected: HTTP 200 with the spike page HTML.

- [ ] **Step 4: Hand the gate test to the user**

Output these instructions (this is the stage-0 gate; do not start Tasks 9+ until the user reports back):

> On the iPhone, open **https://saiteja0847.github.io/Barcode-scanner/spike.html** (cellular data is fine — after it loads once, decoding runs entirely on the phone).
> 1. Confirm the top line says **Self-test: PASS**.
> 2. Allow camera access.
> 3. Point it at 10 different real products (at the store if possible). A product "passes" if its number appears in the list within ~3 seconds.
> **Gate: ≥9 of 10 pass → build continues. Worse → we discuss the native fallback.**

---

### Task 5: Barcode normalization (pure logic, TDD)

**Files:**
- Create: `src/logic/normalize.ts`, `tests/normalize.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `normalizeBarcode(rawValue: string, format: string): string | null` and `expandUpcE(value: string): string | null`. Tasks 7 and 10 consume `normalizeBarcode`; null means "ignore this decode".

- [ ] **Step 1: Write the failing tests**

`tests/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { expandUpcE, normalizeBarcode } from "../src/logic/normalize";

describe("expandUpcE", () => {
  it.each([
    ["01234565", "012345000065"], // last payload digit 6 → mfr d1..d5, item 0000+d6
    ["04252614", "042100005264"], // last payload digit 1 → mfr d1 d2 d6 00, item 00+d3 d4 d5
  ])("expands %s to UPC-A %s", (upcE, upcA) => {
    expect(expandUpcE(upcE)).toBe(upcA);
  });

  it("rejects anything that is not 8 digits", () => {
    expect(expandUpcE("123456")).toBeNull();
    expect(expandUpcE("")).toBeNull();
    expect(expandUpcE("abcdefgh")).toBeNull();
    expect(expandUpcE("123456789")).toBeNull();
  });
});

describe("normalizeBarcode", () => {
  it("keeps EAN-13 as-is", () => {
    expect(normalizeBarcode("4006381333931", "ean_13")).toBe("4006381333931");
  });

  it("pads UPC-A to 13-digit canonical form", () => {
    expect(normalizeBarcode("036000291452", "upc_a")).toBe("0036000291452");
  });

  it("accepts engines that already report UPC-A as 13 digits", () => {
    expect(normalizeBarcode("0036000291452", "upc_a")).toBe("0036000291452");
  });

  it("unifies the same product scanned as upc_a vs ean_13", () => {
    expect(normalizeBarcode("036000291452", "upc_a")).toBe(normalizeBarcode("0036000291452", "ean_13"));
  });

  it("expands UPC-E and pads to canonical form", () => {
    expect(normalizeBarcode("01234565", "upc_e")).toBe("0012345000065");
  });

  it("keeps EAN-8 as-is and never pads it", () => {
    expect(normalizeBarcode("96385074", "ean_8")).toBe("96385074");
  });

  it("passes code_128 strings through", () => {
    expect(normalizeBarcode("STORE-00042", "code_128")).toBe("STORE-00042");
  });

  it("trims whitespace", () => {
    expect(normalizeBarcode(" 4006381333931 ", "ean_13")).toBe("4006381333931");
  });

  it.each([
    ["", "ean_13"],
    ["123", "ean_13"],
    ["40063813339x1", "ean_13"],
    ["1234567890123", "qr_code"],
    ["", "code_128"],
    ["12345678901", "upc_a"],
    ["1234567", "ean_8"],
  ])("rejects %j as %s", (value, format) => {
    expect(normalizeBarcode(value, format)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/logic/normalize'`

- [ ] **Step 3: Write the implementation**

`src/logic/normalize.ts`:

```ts
const DIGITS = /^[0-9]+$/;

/**
 * Expand an 8-digit UPC-E (number system + 6 payload digits + check digit)
 * to its 12-digit UPC-A equivalent. The check digit carries over unchanged.
 */
export function expandUpcE(value: string): string | null {
  if (value.length !== 8 || !DIGITS.test(value)) return null;
  const numberSystem = value[0]!;
  const check = value[7]!;
  const [d1, d2, d3, d4, d5, d6] = value.slice(1, 7).split("") as [string, string, string, string, string, string];
  let body: string;
  if (d6 === "0" || d6 === "1" || d6 === "2") body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === "3") body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === "4") body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${numberSystem}${body}${check}`;
}

/**
 * Canonical form: EAN-13/UPC family → 13-digit GTIN-13 (UPC-A zero-padded);
 * EAN-8 stays 8 digits (distinct namespace — padding could collide);
 * Code-128 passes through raw. Returns null for anything malformed or
 * outside the allowed formats — callers must ignore null.
 */
export function normalizeBarcode(rawValue: string, format: string): string | null {
  const value = rawValue.trim();
  switch (format) {
    case "ean_13":
      return value.length === 13 && DIGITS.test(value) ? value : null;
    case "upc_a":
      if (!DIGITS.test(value) || value.length === 0) return null;
      if (value.length === 12) return "0" + value;
      if (value.length === 13 && value.startsWith("0")) return value;
      return null;
    case "upc_e": {
      const upcA = expandUpcE(value);
      return upcA === null ? null : "0" + upcA;
    }
    case "ean_8":
      return value.length === 8 && DIGITS.test(value) ? value : null;
    case "code_128":
      return value.length > 0 ? value : null;
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add tests/normalize.test.ts src/logic/normalize.ts
git commit -m "feat: add barcode normalization with UPC-E expansion"
```

---

### Task 6: Scan cooldown gate (pure logic, TDD)

**Files:**
- Create: `src/logic/gate.ts`, `tests/gate.test.ts`

**Interfaces:**
- Consumes: nothing (cooldown value injected)
- Produces: `class ScanGate { constructor(cooldownMs: number); shouldProcess(code: string, nowMs: number): boolean }`. Task 10 consumes it with `SCAN_COOLDOWN_MS`.

- [ ] **Step 1: Write the failing tests**

`tests/gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ScanGate } from "../src/logic/gate";

describe("ScanGate", () => {
  it("lets the first sighting of a code through", () => {
    const gate = new ScanGate(3000);
    expect(gate.shouldProcess("A", 1000)).toBe(true);
  });

  it("suppresses repeats inside the cooldown", () => {
    const gate = new ScanGate(3000);
    gate.shouldProcess("A", 1000);
    expect(gate.shouldProcess("A", 2500)).toBe(false);
  });

  it("keeps suppressing while the camera stays on the same code (timer resets on every sighting)", () => {
    const gate = new ScanGate(3000);
    gate.shouldProcess("A", 1000);
    expect(gate.shouldProcess("A", 2500)).toBe(false); // resets clock to 2500
    expect(gate.shouldProcess("A", 4600)).toBe(false); // only 2100ms after last sighting
  });

  it("lets a code through again after a real pause", () => {
    const gate = new ScanGate(3000);
    gate.shouldProcess("A", 1000);
    expect(gate.shouldProcess("A", 4200)).toBe(true);
  });

  it("tracks codes independently", () => {
    const gate = new ScanGate(3000);
    gate.shouldProcess("A", 1000);
    expect(gate.shouldProcess("B", 1100)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/logic/gate'`

- [ ] **Step 3: Write the implementation**

`src/logic/gate.ts`:

```ts
/**
 * Suppresses repeat decodes of the same code. Every sighting refreshes the
 * timestamp, so holding the camera on one product fires exactly once and
 * only re-fires after the code has been out of frame for a full cooldown.
 */
export class ScanGate {
  private readonly lastSeen = new Map<string, number>();

  constructor(private readonly cooldownMs: number) {}

  shouldProcess(code: string, nowMs: number): boolean {
    const last = this.lastSeen.get(code);
    this.lastSeen.set(code, nowMs);
    return last === undefined || nowMs - last >= this.cooldownMs;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/gate.test.ts src/logic/gate.ts
git commit -m "feat: add scan cooldown gate"
```

---

### Task 7: Storage decisions (pure logic, TDD)

**Files:**
- Create: `src/logic/store.ts`, `tests/store.test.ts`

**Interfaces:**
- Consumes: canonical barcodes (contract: callers pass non-null output of `normalizeBarcode`)
- Produces:
  - `interface StorageItem { barcode: string; name?: string; addedAt: string }`
  - `type StorageScanDecision = { action: "add"; item: StorageItem } | { action: "exists"; item: StorageItem }`
  - `decideStorageScan(existing: StorageItem | undefined, barcode: string, nowIso: string): StorageScanDecision`
  - `type StoreScanResult = { inStorage: true; item: StorageItem } | { inStorage: false }`
  - `decideStoreScan(existing: StorageItem | undefined): StoreScanResult`
  - Tasks 8, 10, 11 consume `StorageItem`; Task 10 consumes both decide functions.

- [ ] **Step 1: Write the failing tests**

`tests/store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decideStorageScan, decideStoreScan, StorageItem } from "../src/logic/store";

const existing: StorageItem = { barcode: "0036000291452", name: "Peas", addedAt: "2026-08-11T10:00:00.000Z" };

describe("decideStorageScan", () => {
  it("adds an unknown barcode with timestamp and no name", () => {
    const d = decideStorageScan(undefined, "4006381333931", "2026-08-11T12:00:00.000Z");
    expect(d).toEqual({
      action: "add",
      item: { barcode: "4006381333931", addedAt: "2026-08-11T12:00:00.000Z" },
    });
  });

  it("reports an existing barcode untouched (name preserved)", () => {
    const d = decideStorageScan(existing, existing.barcode, "2026-08-11T12:00:00.000Z");
    expect(d).toEqual({ action: "exists", item: existing });
  });
});

describe("decideStoreScan", () => {
  it("finds an item that is in storage", () => {
    expect(decideStoreScan(existing)).toEqual({ inStorage: true, item: existing });
  });

  it("reports a missing item", () => {
    expect(decideStoreScan(undefined)).toEqual({ inStorage: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/logic/store'`

- [ ] **Step 3: Write the implementation**

`src/logic/store.ts`:

```ts
export interface StorageItem {
  barcode: string;
  name?: string;
  addedAt: string;
}

export type StorageScanDecision =
  | { action: "add"; item: StorageItem }
  | { action: "exists"; item: StorageItem };

export function decideStorageScan(
  existing: StorageItem | undefined,
  barcode: string,
  nowIso: string,
): StorageScanDecision {
  if (existing) return { action: "exists", item: existing };
  return { action: "add", item: { barcode, addedAt: nowIso } };
}

export type StoreScanResult = { inStorage: true; item: StorageItem } | { inStorage: false };

export function decideStoreScan(existing: StorageItem | undefined): StoreScanResult {
  return existing ? { inStorage: true, item: existing } : { inStorage: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/store.test.ts src/logic/store.ts
git commit -m "feat: add storage decision logic"
```

---

### Task 8: IndexedDB item store (provider, TDD via fake-indexeddb)

**Files:**
- Create: `src/providers/db.ts`, `tests/db.test.ts`

**Interfaces:**
- Consumes: `StorageItem` (Task 7), `DB_NAME`, `DB_STORE` (Task 1)
- Produces:
  - `interface ItemStore { get(barcode: string): Promise<StorageItem | undefined>; put(item: StorageItem): Promise<void>; remove(barcode: string): Promise<void>; all(): Promise<StorageItem[]> }`
  - `class IndexedDbItemStore implements ItemStore`
  - Tasks 10 and 11 consume `ItemStore` / `IndexedDbItemStore`.

- [ ] **Step 1: Write the failing tests**

`tests/db.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDbItemStore } from "../src/providers/db";
import type { StorageItem } from "../src/logic/store";

const item: StorageItem = { barcode: "0036000291452", name: "Peas", addedAt: "2026-08-11T10:00:00.000Z" };

describe("IndexedDbItemStore", () => {
  beforeEach(() => {
    // fresh in-memory IndexedDB per test — no cross-test state
    globalThis.indexedDB = new IDBFactory();
  });

  it("returns undefined for a barcode never stored", async () => {
    const db = new IndexedDbItemStore();
    expect(await db.get("0000000000000")).toBeUndefined();
  });

  it("round-trips an item", async () => {
    const db = new IndexedDbItemStore();
    await db.put(item);
    expect(await db.get(item.barcode)).toEqual(item);
  });

  it("overwrites on same barcode (used by rename)", async () => {
    const db = new IndexedDbItemStore();
    await db.put(item);
    await db.put({ ...item, name: "Frozen peas" });
    expect((await db.get(item.barcode))?.name).toBe("Frozen peas");
    expect(await db.all()).toHaveLength(1);
  });

  it("removes an item", async () => {
    const db = new IndexedDbItemStore();
    await db.put(item);
    await db.remove(item.barcode);
    expect(await db.get(item.barcode)).toBeUndefined();
  });

  it("lists everything stored", async () => {
    const db = new IndexedDbItemStore();
    await db.put(item);
    await db.put({ barcode: "4006381333931", addedAt: "2026-08-11T11:00:00.000Z" });
    const all = await db.all();
    expect(all.map((i) => i.barcode).sort()).toEqual(["0036000291452", "4006381333931"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/providers/db'`

- [ ] **Step 3: Write the implementation**

`src/providers/db.ts`:

```ts
import { DB_NAME, DB_STORE } from "../config";
import type { StorageItem } from "../logic/store";

export interface ItemStore {
  get(barcode: string): Promise<StorageItem | undefined>;
  put(item: StorageItem): Promise<void>;
  remove(barcode: string): Promise<void>;
  all(): Promise<StorageItem[]>;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB request failed"));
  });
}

export class IndexedDbItemStore implements ItemStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const openReq = indexedDB.open(DB_NAME, 1);
        openReq.onupgradeneeded = () => {
          openReq.result.createObjectStore(DB_STORE, { keyPath: "barcode" });
        };
        openReq.onsuccess = () => resolve(openReq.result);
        openReq.onerror = () => reject(openReq.error ?? new Error("IndexedDB open failed"));
      });
    }
    return this.dbPromise;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.open();
    return db.transaction(DB_STORE, mode).objectStore(DB_STORE);
  }

  async get(barcode: string): Promise<StorageItem | undefined> {
    return req((await this.store("readonly")).get(barcode)) as Promise<StorageItem | undefined>;
  }

  async put(item: StorageItem): Promise<void> {
    await req((await this.store("readwrite")).put(item));
  }

  async remove(barcode: string): Promise<void> {
    await req((await this.store("readwrite")).delete(barcode));
  }

  async all(): Promise<StorageItem[]> {
    return req((await this.store("readonly")).getAll()) as Promise<StorageItem[]>;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all suites, including earlier ones).

- [ ] **Step 5: Commit**

```bash
git add tests/db.test.ts src/providers/db.ts
git commit -m "feat: add IndexedDB item store"
```

---

**═══ GATE CHECKPOINT: do not proceed past here until the user reports the Task 4 phone-spike result (≥9/10 products decoded <3 s). ═══**

---

### Task 9: Audio + overlay UI modules

**Files:**
- Create: `src/ui/audio.ts`, `src/ui/overlay.ts`, `src/ui/style.css`

**Interfaces:**
- Consumes: nothing app-specific
- Produces:
  - `initAudio(): void`, `beep: { added(): void; exists(): void; inStorage(): void; notInStorage(): void; error(): void }`
  - `type FlashKind = "green" | "red" | "gray"`
  - `showResult(kind: FlashKind, title: string, subtitle: string, actions?: { onSaveName?: (name: string) => void; onRemove?: () => void }): void`
  - `hideOverlay(): void`, `isNameSheetOpen(): boolean`
  - Task 10 consumes all of these. Requires an element `<div id="overlay">` in the DOM.

- [ ] **Step 1: Write the audio module**

`src/ui/audio.ts`:

```ts
let ctx: AudioContext | null = null;

/** Must be called from a user gesture once — iOS refuses autoplaying audio contexts. */
export function initAudio(): void {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, startMs: number, durMs: number): void {
  if (!ctx || ctx.state !== "running") return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.value = 0.15;
  osc.connect(gain).connect(ctx.destination);
  const t0 = ctx.currentTime + startMs / 1000;
  osc.start(t0);
  osc.stop(t0 + durMs / 1000);
}

export const beep = {
  added: () => {
    tone(880, 0, 90);
    tone(1320, 120, 90);
  },
  exists: () => tone(660, 0, 90),
  inStorage: () => tone(880, 0, 150),
  notInStorage: () => tone(220, 0, 220),
  error: () => {
    tone(220, 0, 120);
    tone(220, 180, 120);
  },
};
```

- [ ] **Step 2: Write the overlay module**

`src/ui/overlay.ts`:

```ts
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
```

- [ ] **Step 3: Write the stylesheet**

`src/ui/style.css`:

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, system-ui, sans-serif;
  background: #111;
  color: #eee;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
header {
  display: flex;
  gap: 8px;
  padding: max(8px, env(safe-area-inset-top)) 10px 8px;
  align-items: center;
}
#mode-toggle { display: flex; flex: 1; gap: 0; border-radius: 10px; overflow: hidden; }
#mode-toggle button {
  flex: 1;
  font-size: 20px;
  font-weight: 700;
  padding: 14px 0;
  border: none;
  background: #2a2a2a;
  color: #888;
}
#btn-storage.active { background: #1d4ed8; color: #fff; }
#btn-store.active { background: #b45309; color: #fff; }
#btn-list {
  font-size: 16px;
  padding: 14px 12px;
  border: none;
  border-radius: 10px;
  background: #2a2a2a;
  color: #eee;
}
#mode-hint { margin: 0; padding: 0 12px 6px; color: #999; font-size: 14px; }
main { position: relative; flex: 1; background: #000; }
video { width: 100%; height: 100%; object-fit: cover; display: block; }
#scan-error { position: absolute; inset: 0; padding: 24px; font-size: 18px; color: #f87171; white-space: pre-wrap; pointer-events: none; }
#scan-error:empty { display: none; }
#overlay {
  position: absolute;
  inset: 0;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
}
#overlay.visible { display: flex; }
.overlay-title { font-size: 44px; font-weight: 800; color: #fff; }
.overlay-sub { font-size: 22px; color: #fff; opacity: 0.9; word-break: break-all; }
.overlay-row { display: flex; gap: 8px; width: 100%; max-width: 420px; flex-wrap: wrap; justify-content: center; }
.name-input { flex: 1 1 100%; font-size: 18px; padding: 12px; border-radius: 10px; border: none; }
.overlay-btn { font-size: 18px; font-weight: 600; padding: 12px 18px; border: none; border-radius: 10px; background: #fff; color: #111; }
.overlay-btn.secondary { background: rgba(255, 255, 255, 0.25); color: #fff; }
#view-list {
  position: fixed;
  inset: 0;
  background: #111;
  display: none;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
}
#view-list.visible { display: flex; }
#view-list header { justify-content: space-between; }
#btn-close-list { font-size: 16px; border: none; background: none; color: #60a5fa; padding: 12px; }
#list-count { color: #999; font-size: 14px; padding-right: 12px; }
#search { margin: 0 12px 8px; font-size: 17px; padding: 12px; border-radius: 10px; border: 1px solid #333; background: #1c1c1c; color: #eee; }
#items { margin: 0; padding: 0 12px; list-style: none; overflow-y: auto; flex: 1; }
#items li { padding: 12px 0; border-bottom: 1px solid #2a2a2a; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
#items li.empty { color: #888; border: none; padding-top: 40px; text-align: center; display: block; }
.item-label { font-size: 18px; font-weight: 600; flex: 1 1 100%; }
.item-meta { color: #888; font-size: 13px; flex: 1; }
.row-btn { font-size: 14px; padding: 8px 12px; border: none; border-radius: 8px; background: #2a2a2a; color: #eee; }
.row-btn.danger { background: #7f1d1d; color: #fecaca; }
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: succeeds (modules are not yet imported anywhere — that's fine; `tsc` still type-checks them via `include`).

- [ ] **Step 5: Commit**

```bash
git add src/ui/audio.ts src/ui/overlay.ts src/ui/style.css
git commit -m "feat: add audio and overlay UI modules"
```

---

### Task 10: Scan screen — full app wiring

**Files:**
- Create: `src/ui/app.ts`, `src/ui/main.ts`
- Modify: `index.html` (replace placeholder entirely)

**Interfaces:**
- Consumes: everything produced by Tasks 1, 3, 5, 6, 7, 8, 9 — exact names: `SCAN_COOLDOWN_MS`, `ScanGate`, `normalizeBarcode`, `decideStorageScan`, `decideStoreScan`, `IndexedDbItemStore`, `BrowserScanner`, `ScannerStartError`, `ScanResult`, `initAudio`, `beep`, `showResult`, `isNameSheetOpen`
- Produces: working scan screen; `renderList(db: ItemStore)` is stubbed as a dynamic import so Task 11 can supply it (`src/ui/list.ts`). DOM ids other modules rely on: `video`, `overlay`, `scan-error`, `btn-storage`, `btn-store`, `btn-list`, `btn-close-list`, `mode-hint`, `view-list`, `search`, `items`, `list-count`.

- [ ] **Step 1: Write the final `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <link rel="apple-touch-icon" href="icons/icon-180.png" />
  <title>Storage Checker</title>
</head>
<body>
  <header>
    <div id="mode-toggle">
      <button id="btn-storage">STORAGE</button>
      <button id="btn-store">STORE</button>
    </div>
    <button id="btn-list">List (0)</button>
  </header>
  <p id="mode-hint"></p>
  <main>
    <video id="video" playsinline muted autoplay></video>
    <div id="scan-error"></div>
    <div id="overlay"></div>
  </main>
  <section id="view-list">
    <header>
      <button id="btn-close-list">← Back to scanning</button>
      <span id="list-count"></span>
    </header>
    <input id="search" type="search" placeholder="Search name or barcode" />
    <ul id="items"></ul>
  </section>
  <script type="module" src="src/ui/main.ts"></script>
</body>
</html>
```

(The `icons/` files don't exist until Task 12 — a 404 on the touch icon is harmless during development.)

- [ ] **Step 2: Write the entry + app modules**

`src/ui/main.ts`:

```ts
import "./style.css";
import "./app";
```

`src/ui/app.ts`:

```ts
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
```

Note: `navigator.wakeLock` may need `skipLibCheck`-era DOM lib types; if `tsc` complains, use `(navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<unknown> } }).wakeLock`.

Note: `import("./list")` will fail to compile until Task 11 creates `src/ui/list.ts`. To keep this task independently buildable, create a minimal placeholder now:

`src/ui/list.ts` (placeholder, replaced in Task 11):

```ts
import type { ItemStore } from "../providers/db";

export async function renderList(db: ItemStore): Promise<void> {
  const items = await db.all();
  document.getElementById("list-count")!.textContent = `${items.length} items`;
}
```

- [ ] **Step 3: Build and verify in a desktop browser**

Run: `npm run build` — Expected: clean.
Run: `npm run dev`, open `http://localhost:5173/`.
Expected: header with STORAGE/STORE toggle (STORE active, amber), hint text, black camera area showing the styled camera-error message (no camera permission on desktop is the expected path — it must render the message, not a blank screen). Tapping "List (0)" opens the list view; "← Back to scanning" returns.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS — UI wiring must not break any logic/provider tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add scan screen UI with mode toggle and overlays"
```

---

### Task 11: List view

**Files:**
- Modify: `src/ui/list.ts` (replace the Task 10 placeholder entirely)

**Interfaces:**
- Consumes: `ItemStore` (Task 8), `StorageItem` (Task 7), DOM ids `items`, `search`, `list-count` (Task 10)
- Produces: `renderList(db: ItemStore): Promise<void>` — same signature as the placeholder, so `app.ts` needs no change.

- [ ] **Step 1: Write the implementation**

`src/ui/list.ts`:

```ts
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
```

- [ ] **Step 2: Build and verify with seeded data in a desktop browser**

Run: `npm run build` — Expected: clean. Run `npm run dev`.

In the browser devtools console on `http://localhost:5173/`, seed test data:

```js
const r = indexedDB.open("storage-checker", 1);
r.onsuccess = () => {
  const tx = r.result.transaction("items", "readwrite");
  tx.objectStore("items").put({ barcode: "0036000291452", name: "Frozen peas", addedAt: "2026-08-10T09:00:00.000Z" });
  tx.objectStore("items").put({ barcode: "4006381333931", addedAt: "2026-08-11T09:00:00.000Z" });
};
```

Reload, open List.
Expected: "List (2)"; two rows, newest first (the unnamed 4006… row on top showing its barcode as label); searching "peas" filters to one row; Rename → type → Save persists after reload; Delete requires the second "Really delete?" tap.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/list.ts
git commit -m "feat: add storage list view with search, rename, delete"
```

---

### Task 12: PWA shell — offline install

**Files:**
- Create: `scripts/make_icons.py`, `public/icons/icon-180.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png` (generated)
- Modify: `vite.config.ts`, `src/ui/main.ts`, `tsconfig.json` (add `"vite-plugin-pwa/client"` to `types`)

**Interfaces:**
- Consumes: the whole built app
- Produces: installable offline PWA — manifest, service worker precaching every asset **including the wasm**, icons.

- [ ] **Step 1: Write the icon generator (stdlib only, no deps)**

`scripts/make_icons.py`:

```python
#!/usr/bin/env python3
"""Generate the app icons (barcode-stripe motif) as PNGs. Stdlib only."""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
STRIPES = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1]


def make_png(size: int) -> bytes:
    bg, fg = (17, 17, 17), (245, 245, 245)
    margin = size // 5
    n = len(STRIPES)
    bar_w = (size - 2 * margin) / n
    rows = []
    for y in range(size):
        row = bytearray([0])  # filter type 0 per scanline
        for x in range(size):
            c = bg
            if margin <= y < size - margin and margin <= x < size - margin:
                idx = min(int((x - margin) / bar_w), n - 1)
                if STRIPES[idx]:
                    c = fg
            row += bytes(c)
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit truecolor
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (180, 192, 512):
        (OUT / f"icon-{size}.png").write_bytes(make_png(size))
        print(f"wrote {OUT.relative_to(Path.cwd()) / f'icon-{size}.png'}" if OUT.is_relative_to(Path.cwd()) else f"wrote icon-{size}.png")


if __name__ == "__main__":
    main()
```

Run: `python3 scripts/make_icons.py`
Expected: three `wrote …` lines; `file public/icons/icon-512.png` reports `PNG image data, 512 x 512`.

- [ ] **Step 2: Add the PWA plugin**

`vite.config.ts` (full new content):

```ts
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    rollupOptions: {
      input: {
        main: "index.html",
        spike: "spike.html",
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Storage Checker",
        short_name: "Storage",
        description: "Scan a product — is it in the back room?",
        display: "standalone",
        orientation: "portrait",
        background_color: "#111111",
        theme_color: "#111111",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm,png,webmanifest}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
});
```

`src/ui/main.ts` (full new content):

```ts
import { registerSW } from "virtual:pwa-register";
import "./style.css";
import "./app";

registerSW({ immediate: true });
```

`tsconfig.json`: change `"types": ["vite/client"]` to `"types": ["vite/client", "vite-plugin-pwa/client"]`.

- [ ] **Step 3: Build and verify the offline bundle**

Run: `npm run build`
Expected: clean build; `dist/sw.js` and `dist/manifest.webmanifest` exist.

Run: `grep -o 'zxing_reader[^"]*wasm' dist/sw.js | head -1`
Expected: prints the hashed wasm filename — proof the service worker precaches the decoder and the app will scan with no network. If empty, the wasm is NOT precached — fix `globPatterns`/`maximumFileSizeToCacheInBytes` before proceeding (this is the airplane-mode failure mode called out in the spec).

Run: `npm run preview`, open the preview URL, devtools → Application → Service Workers.
Expected: service worker registered and activated; reload with devtools Network set to "Offline" still renders the app shell.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add PWA shell with offline precache and icons"
```

---

### Task 13: Deploy v1 + handoff

**Files:**
- Create: `SESSION.md`, `README.md`

**Interfaces:**
- Consumes: everything
- Produces: live app + written handoff.

- [ ] **Step 1: Write `README.md`**

```markdown
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
```

- [ ] **Step 2: Push and verify deploy**

```bash
git add README.md
git commit -m "docs: add README with install and usage instructions"
git push
gh run watch --exit-status
```

Expected: workflow `success`. Fetch `https://saiteja0847.github.io/Barcode-scanner/` — expected HTTP 200, final app HTML (not the placeholder).

- [ ] **Step 3: Write `SESSION.md`** (per global session-continuity rule)

```markdown
# Session — 2026-08-11

## Done
- Spec + plan (docs/superpowers/).
- v1 built and deployed: https://saiteja0847.github.io/Barcode-scanner/
- All tasks committed; tests green (`npm test`); offline precache verified incl. wasm.

## Works
- Storage/Store scan modes, cooldown, normalization (UPC-A/E→GTIN-13), list view,
  IndexedDB persistence, PWA offline install.

## Next step
- User acceptance on the real iPhone: install to home screen, run the
  airplane-mode checklist (scan both modes offline, restart phone, list intact).
- v1.1 candidates: export/backup of the list; remove-confirmation undo.
```

- [ ] **Step 4: Final acceptance instructions for the user**

Output the phone acceptance checklist:

> 1. Open the live URL in Safari on the iPhone → Share → Add to Home Screen → open from home screen, allow camera.
> 2. STORAGE mode: scan 3 products → each shows ADDED ✓; rescan one → "Already in storage".
> 3. STORE mode: scan those products → IN THE BACK ✓; scan an unscanned product → NOT IN STORAGE ✗.
> 4. **Airplane Mode on**: repeat step 3 — identical behavior expected.
> 5. Restart the phone, reopen from home screen (still offline): list intact.

- [ ] **Step 5: Commit**

```bash
git add SESSION.md
git commit -m "chore: write session handoff"
git push
```

---

## Self-Review (completed at plan time)

- **Spec coverage:** flows (T9–T11), data model + normalization (T5, T7, T8), architecture/layering (structure of T1–T3), edge cases (permission-denied T10, db-failure T10 `showDbError`, cooldown T6, format allowlist T3/T5, UPC unification T5), PWA/offline (T12), spike gate (T3–T4), acceptance tests (T13). Export/backup is spec'd out-of-scope (v1.1) — intentionally no task.
- **Placeholder scan:** the only intentional placeholder is `src/ui/list.ts` in Task 10, explicitly replaced by Task 11 with the same signature.
- **Type consistency:** `ItemStore.get/put/remove/all`, `StorageItem{barcode,name?,addedAt}`, `ScanGate.shouldProcess(code,nowMs)`, `normalizeBarcode(rawValue,format)`, `ScannerStartError.kind`, `showResult(kind,title,subtitle,actions)`, `renderList(db)` — verified uniform across tasks.
