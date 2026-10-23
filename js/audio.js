// ============================================================================
// TEAM HAT TRICK (1985 Bally Sente) - Web Audio CEM3394 Analog Synth Engine
// ============================================================================

export class ArcadeAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.zamboniTimer = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopZamboniTune();
    }
    return this.muted;
  }

  playTone(freq, duration, type = 'sawtooth', vol = 0.15, slideTo = null, delay = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    }

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playNoise(duration, filterFreq = 1000, vol = 0.15, delay = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + delay;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(2.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
  }

  playCoin() {
    this.playTone(987.77, 0.08, 'square', 0.18, null, 0);
    this.playTone(1318.51, 0.28, 'square', 0.18, null, 0.08);
  }

  playSelect() {
    this.playTone(523.25, 0.07, 'square', 0.15, null, 0);
    this.playTone(783.99, 0.12, 'square', 0.15, null, 0.06);
  }

  playTick() {
    this.playTone(440, 0.04, 'square', 0.09);
  }

  playWhistle() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    // Refereepea-whistle trill
    for (let i = 0; i < 6; i++) {
      this.playTone(2800 + (i % 2) * 280, 0.045, 'triangle', 0.16, null, i * 0.045);
    }
  }

  playShoot() {
    this.playNoise(0.08, 1400, 0.22);
    this.playTone(220, 0.09, 'triangle', 0.18, 70);
  }

  playBounce() {
    this.playTone(140, 0.06, 'sine', 0.16, 55);
  }

  playSave() {
    this.playTone(300, 0.08, 'triangle', 0.2, 120);
    this.playTone(520, 0.12, 'square', 0.12, 260, 0.04);
  }

  playCheck() {
    // Heavy body check thump + synthesized crowd boo/groan
    this.playNoise(0.16, 400, 0.28);
    this.playTone(110, 0.18, 'sawtooth', 0.22, 42);
    this.playTone(190, 0.35, 'sawtooth', 0.08, 130, 0.1);
    this.playTone(183, 0.35, 'sawtooth', 0.08, 125, 0.1);
  }

  playGoalFanfare() {
    // Goal horn + crowd roar + stadium organ "Charge!"
    this.playTone(146.83, 0.65, 'sawtooth', 0.18);
    this.playTone(220.00, 0.65, 'sawtooth', 0.16);
    this.playNoise(0.8, 900, 0.16);

    const notes = [
      [392.00, 0.12, 0.70], // G4
      [523.25, 0.12, 0.83], // C5
      [659.25, 0.12, 0.96], // E5
      [783.99, 0.24, 1.09], // G5
      [659.25, 0.10, 1.36], // E5
      [783.99, 0.45, 1.48]  // G5
    ];
    for (const [f, d, delay] of notes) {
      this.playTone(f, d, 'square', 0.14, null, delay);
      this.playTone(f * 0.5, d, 'triangle', 0.10, null, delay);
    }
  }

  playBuzzer() {
    this.playTone(98, 0.9, 'sawtooth', 0.22);
    this.playTone(103, 0.9, 'square', 0.18);
  }

  startZamboniTune() {
    this.stopZamboniTune();
    if (this.muted) return;

    // Classic jaunty arcade organ melody while the Zamboni clears the ice
    const melody = [
      [523.25, 0.18], [587.33, 0.18], [659.25, 0.18], [523.25, 0.18],
      [659.25, 0.18], [783.99, 0.32], [659.25, 0.18], [523.25, 0.18],
      [587.33, 0.18], [659.25, 0.18], [587.33, 0.18], [493.88, 0.18],
      [523.25, 0.36], [0, 0.18]
    ];

    let step = 0;
    this.zamboniTimer = setInterval(() => {
      if (this.muted) return;
      const [freq, dur] = melody[step % melody.length];
      if (freq > 0) {
        this.playTone(freq, dur * 0.9, 'square', 0.09);
        this.playTone(freq * 0.5, dur * 0.9, 'triangle', 0.07);
      }
      step++;
    }, 210);
  }

  stopZamboniTune() {
    if (this.zamboniTimer) {
      clearInterval(this.zamboniTimer);
      this.zamboniTimer = null;
    }
  }
}
