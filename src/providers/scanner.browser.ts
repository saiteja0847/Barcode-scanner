import { BarcodeDetector, type BarcodeFormat } from "barcode-detector/ponyfill";
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

    const detector = new BarcodeDetector({ formats: [...ALLOWED_FORMATS] as BarcodeFormat[] });
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
