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
