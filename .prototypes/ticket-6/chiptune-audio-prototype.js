// Prototype: chiptune-style SFX via Web Audio API oscillators (no external audio files needed)
// Demonstrates the audio recreation approach decided in ticket #6.

function playTone(ctx, freq, duration, type = "square") {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playJumpSfx(ctx) {
  playTone(ctx, 440, 0.12, "square");
  setTimeout(() => playTone(ctx, 660, 0.1, "square"), 60);
}

export function playClimbSfx(ctx) {
  playTone(ctx, 300, 0.08, "triangle");
}

export function playLoseLifeSfx(ctx) {
  playTone(ctx, 200, 0.3, "sawtooth");
  setTimeout(() => playTone(ctx, 120, 0.4, "sawtooth"), 150);
}

// Background music would follow the same oscillator-sequencing approach:
// a simple step-sequenced melody loop, not a pre-recorded audio file,
// consistent with 1980s arcade chiptune sound generation.
