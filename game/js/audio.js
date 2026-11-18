// All sound is synthesised with WebAudio — no audio files. A tiny synth desk: an engine
// hum tied to speed, a two-tone siren, noise-burst gunshots and crashes, and little
// arpeggio jingles for cash and completed jobs. Everything fails silently if the
// browser has no AudioContext or the player has not gestured yet.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 3000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
  }

  function engine(on, speedNorm) {
    if (!ensure()) return;
    if (on && !engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineGain.gain.value = 0.0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter).connect(engineGain).connect(master);
      engineOsc.start();
    }
    if (engineOsc) {
      const target = on && !muted ? 0.05 + speedNorm * 0.05 : 0;
      engineOsc.frequency.setTargetAtTime(55 + speedNorm * 165, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.09);
    }
    if (!on && engineOsc) {
      const osc = engineOsc;
      const gain = engineGain;
      engineOsc = null;
      engineGain = null;
      setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 250);
      if (gain) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    }
  }

  function siren(on, dt) {
    if (!ensure()) return;
    if (on && !sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
    }
    if (sirenOsc) {
      sirenTimer += dt || 0;
      const high = Math.floor(sirenTimer * 1.6) % 2 === 0;
      sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, ctx.currentTime, 0.03);
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.028 : 0, ctx.currentTime, 0.1);
      if (!on) {
        const osc = sirenOsc;
        sirenOsc = null;
        sirenGain = null;
        setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 300);
      }
    }
  }

  return {
    unlock: ensure,
    engine,
    siren,
    shot() { noise(0.11, 0.5, 4200); tone(150, 0.07, 'square', 0.18, 60); },
    enemyShot() { noise(0.09, 0.3, 3000); },
    crash(strength) { noise(0.22, Math.min(0.7, 0.2 + strength * 0.5), 900); tone(70, 0.18, 'sine', 0.3, 40); },
    scrape() { noise(0.08, 0.12, 5200); },
    pickup() { tone(880, 0.09, 'sine', 0.25); setTimeout(() => tone(1320, 0.12, 'sine', 0.22), 55); },
    cash() { tone(990, 0.08, 'triangle', 0.25); setTimeout(() => tone(1180, 0.08, 'triangle', 0.25), 60); setTimeout(() => tone(1480, 0.14, 'triangle', 0.25), 120); },
    jingle() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.28), i * 110)); },
    fail() { tone(220, 0.3, 'sawtooth', 0.2, 110); setTimeout(() => tone(165, 0.4, 'sawtooth', 0.2, 82), 160); },
    click() { tone(660, 0.05, 'sine', 0.15); },
    door() { tone(180, 0.08, 'sine', 0.2, 90); },
    toggleMute() { muted = !muted; return muted; },
    isMuted: () => muted,
  };
}
