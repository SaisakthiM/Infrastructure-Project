/** Small Web Audio synth for UI / world sound effects (no audio files needed). */
let ctx: AudioContext | null = null;
let enabled = true;

export function initAudio() {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) ctx = new Ctor();
  }
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function setSfxEnabled(value: boolean) {
  enabled = value;
  if (value) initAudio();
}

export function playTone(
  frequency: number,
  type: OscillatorType = "sine",
  duration = 0.12,
  gain = 0.08,
) {
  if (!enabled || !ctx) return;
  try {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    /* audio is optional */
  }
}
