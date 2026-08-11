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
