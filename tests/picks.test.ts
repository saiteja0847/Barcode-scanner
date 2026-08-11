import { describe, expect, it } from "vitest";
import { clampQty } from "../src/logic/picks";

describe("clampQty", () => {
  it("keeps sane values", () => {
    expect(clampQty(1)).toBe(1);
    expect(clampQty(5)).toBe(5);
    expect(clampQty(99)).toBe(99);
  });

  it("floors fractions", () => {
    expect(clampQty(3.7)).toBe(3);
  });

  it("clamps to at least 1", () => {
    expect(clampQty(0)).toBe(1);
    expect(clampQty(-5)).toBe(1);
  });

  it("caps at 99", () => {
    expect(clampQty(150)).toBe(99);
  });

  it("falls back to 1 for garbage", () => {
    expect(clampQty(Number.NaN)).toBe(1);
    expect(clampQty(Number.POSITIVE_INFINITY)).toBe(99);
  });
});
