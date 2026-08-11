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
