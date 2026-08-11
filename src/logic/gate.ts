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
