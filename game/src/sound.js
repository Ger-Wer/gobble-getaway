// Procedural sound: tiny WebAudio blips for every moment of the run, no
// assets. The context is created on the first user gesture (browsers require
// it) and every sound is a no-op while muted or before the context exists.

export function createSound() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  /** A pitched tone that slides and fades. */
  function tone(freq, endFreq, dur, type, vol, delay) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A short burst of filtered noise (flaps, thuds, whooshes). */
  function noise(dur, vol, freq, delay) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime + (delay || 0);
    const frames = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq || 900;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol || 0.15, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t0);
  }

  return {
    /** Call on the first user gesture. */
    unlock() { ensure(); },
    setMuted(m) { muted = Boolean(m); },
    isMuted() { return muted; },
    jump() { tone(300, 620, 0.14, 'square', 0.08); },
    flap() { noise(0.12, 0.2, 1600); tone(500, 900, 0.08, 'triangle', 0.06); },
    land() { noise(0.08, 0.14, 300); },
    corn() { tone(880, 1320, 0.09, 'triangle', 0.1); tone(1320, 1760, 0.08, 'triangle', 0.07, 0.06); },
    near() { tone(660, 990, 0.07, 'triangle', 0.08); },
    hit() { tone(220, 70, 0.3, 'sawtooth', 0.16); noise(0.18, 0.2, 500); },
    lunge() { noise(0.4, 0.16, 240); },
    stage() { tone(523, 523, 0.1, 'square', 0.08); tone(659, 659, 0.1, 'square', 0.08, 0.1); tone(784, 784, 0.16, 'square', 0.08, 0.2); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.18, 'square', 0.1, i * 0.13)); },
    lose() { tone(300, 90, 0.7, 'sawtooth', 0.12); noise(0.5, 0.12, 200, 0.1); },
    gobble() { tone(180, 120, 0.12, 'sawtooth', 0.14); tone(240, 160, 0.1, 'sawtooth', 0.12, 0.14); },
  };
}
