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
