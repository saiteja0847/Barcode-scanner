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
