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
