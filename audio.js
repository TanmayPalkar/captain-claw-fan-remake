const MIDI = (note) => 440 * Math.pow(2, (note - 69) / 12);

const MELODY = [
  69, null, 72, null, 76, 74, 72, 69,
  71, null, 67, null, 64, null, 67, 71,
  69, null, 72, 74, 76, null, 74, 72,
  71, 69, 67, null, 64, null, 69, null,
];

const BASS = [45, 45, 41, 43, 45, 41, 43, 40];
const PLUCKS = [57, 60, 64, 60, 57, 60, 64, 55];

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.delay = null;
    this.noiseBuffer = null;
    this.unlocked = false;
    this.enabled = true;
    this.musicTimer = null;
    this.nextNoteTime = 0;
    this.musicStep = 0;
    this.stepDuration = 60 / 96 / 2;
    this.ambientStarted = false;
    this.paused = false;

    try {
      const saved = localStorage.getItem('captain-claw-sound');
      if (saved === 'off') this.enabled = false;
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }

  async unlock() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        return;
      }
    }
    this.unlocked = true;
    if (!this.ambientStarted) this.startAmbient();
  }

  init() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.ctx = new AudioCtor();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.72 : 0;
    this.master.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.2;
    this.musicBus.connect(this.master);

    this.delay = this.ctx.createDelay(0.6);
    this.delay.delayTime.value = 0.19;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.18;
    const delayFilter = this.ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 2200;
    this.delay.connect(delayFilter);
    delayFilter.connect(feedback);
    feedback.connect(this.delay);
    delayFilter.connect(this.musicBus);

    const len = Math.floor(this.ctx.sampleRate * 1.2);
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    try {
      localStorage.setItem('captain-claw-sound', enabled ? 'on' : 'off');
    } catch {
      // Ignore storage failures.
    }
    if (this.ctx && this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(enabled ? 0.72 : 0, this.ctx.currentTime + 0.08);
    }
    if (enabled) this.unlock();
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  startAmbient() {
    if (!this.ctx || this.ambientStarted) return;
    this.ambientStarted = true;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.55;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.016;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.008;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    lfo.start();
  }

  startMusic() {
    if (!this.ctx) return;
    if (this.musicTimer) return;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 70);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setPaused(paused) {
    this.paused = paused;
    if (!this.ctx || !this.musicBus) return;
    const target = paused ? 0.07 : 0.2;
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.18);
  }

  scheduleMusic() {
    if (!this.ctx || !this.enabled) return;
    if (this.paused) {
      this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.05);
    }
    let guard = 0;
    while (this.nextNoteTime < this.ctx.currentTime + 0.28 && guard < 8) {
      this.scheduleMusicStep(this.musicStep, this.nextNoteTime);
      this.nextNoteTime += this.stepDuration;
      this.musicStep = (this.musicStep + 1) % 32;
      guard++;
    }
  }

  scheduleMusicStep(step, when) {
    const melodyNote = MELODY[step];
    if (melodyNote !== null) {
      this.musicTone(MIDI(melodyNote), 0.26, when, 'triangle', 0.09);
      this.musicTone(MIDI(melodyNote) * 2, 0.16, when, 'sine', 0.025);
    }

    if (step % 4 === 0) {
      const bass = BASS[(step / 4) % BASS.length];
      this.musicTone(MIDI(bass), 0.48, when, 'sawtooth', 0.045, 620);
      this.musicNoise(0.09, 0.022, 'lowpass', 130, 0.7, when);
    }

    if (step % 2 === 0) {
      const chord = PLUCKS[(step / 2) % PLUCKS.length];
      this.musicTone(MIDI(chord), 0.12, when + this.stepDuration * 0.52, 'triangle', 0.016);
    }

    if (step % 4 === 2) {
      this.musicNoise(0.045, 0.012, 'highpass', 4200, 0.8, when);
    }
  }

  musicTone(freq, dur, when, type, vol, filterFreq = 2400) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(vol, when + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    gain.connect(this.delay);
    osc.start(when);
    osc.stop(when + dur + 0.03);
  }

  musicNoise(dur, vol, filterType, freq, q, when) {
    if (!this.ctx || !this.enabled) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    source.start(when);
    source.stop(when + dur + 0.02);
  }

  tone(freq, dur, type = 'sine', vol = 0.1, when = 0, endFreq = null, bus = 'sfx') {
    if (!this.ctx || !this.enabled) return;
    const start = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), start);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + dur);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    osc.start(start);
    osc.stop(start + dur + 0.04);
  }

  noise(dur, vol = 0.1, filterType = 'lowpass', freq = 1200, q = 0.7, when = 0, endFreq = null) {
    if (!this.ctx || !this.enabled) return;
    const start = this.ctx.currentTime + when;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, start);
    if (endFreq !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), start + dur);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    source.start(start);
    source.stop(start + dur + 0.03);
  }

  swing() {
    this.noise(0.14, 0.16, 'bandpass', 1900, 0.9, 0, 420);
    this.tone(220, 0.1, 'triangle', 0.04, 0, 100);
  }

  hit() {
    this.noise(0.1, 0.16, 'lowpass', 900, 0.6, 0, 180);
    this.tone(125, 0.16, 'sine', 0.12, 0, 55);
  }

  enemyHit() {
    this.noise(0.07, 0.09, 'bandpass', 700, 0.8);
    this.tone(170, 0.11, 'square', 0.04, 0, 80);
  }

  jump() {
    this.tone(220, 0.13, 'triangle', 0.08, 0, 540);
    this.noise(0.06, 0.025, 'highpass', 1600, 0.7);
  }

  land() {
    this.noise(0.09, 0.1, 'lowpass', 420, 0.7, 0, 100);
    this.tone(90, 0.09, 'sine', 0.06, 0, 48);
  }

  coin() {
    this.tone(1046, 0.07, 'sine', 0.07);
    this.tone(1568, 0.11, 'sine', 0.06, 0.055);
  }

  gem() {
    this.tone(880, 0.09, 'triangle', 0.06);
    this.tone(1174, 0.09, 'triangle', 0.06, 0.07);
    this.tone(1568, 0.16, 'triangle', 0.06, 0.14);
  }

  chest() {
    [523, 659, 784, 1046].forEach((n, i) => this.tone(n, 0.24, 'triangle', 0.06, i * 0.085));
    this.noise(0.25, 0.03, 'bandpass', 1600, 0.8, 0.02, 500);
  }

  food() {
    this.tone(392, 0.1, 'triangle', 0.06);
    this.tone(523, 0.15, 'triangle', 0.06, 0.08);
  }

  checkpoint() {
    [659, 880, 1046].forEach((n, i) => this.tone(n, 0.3, 'sine', 0.055, i * 0.1));
  }

  hurt() {
    this.tone(260, 0.25, 'sawtooth', 0.1, 0, 70);
    this.noise(0.14, 0.08, 'lowpass', 900, 0.6, 0, 200);
  }

  death() {
    [440, 330, 247, 165].forEach((n, i) => this.tone(n, 0.28, 'triangle', 0.08, i * 0.13, n * 0.8));
    this.noise(0.7, 0.06, 'lowpass', 600, 0.7, 0.2, 80);
  }

  shoot() {
    this.noise(0.16, 0.12, 'bandpass', 1300, 0.6, 0, 300);
    this.tone(160, 0.14, 'square', 0.06, 0, 65);
  }

  knife() {
    this.noise(0.1, 0.08, 'highpass', 1400, 0.7, 0, 4000);
    this.tone(600, 0.08, 'triangle', 0.03, 0, 1000);
  }

  clash() {
    this.noise(0.06, 0.08, 'highpass', 2600, 0.7);
    this.tone(880, 0.06, 'square', 0.025, 0, 440);
  }

  gate() {
    this.tone(58, 0.8, 'sawtooth', 0.08, 0, 34);
    this.noise(0.7, 0.06, 'lowpass', 300, 0.7, 0, 70);
  }

  roar() {
    this.tone(95, 1.05, 'sawtooth', 0.12, 0, 42);
    this.noise(0.9, 0.1, 'bandpass', 340, 0.8, 0.05, 120);
  }

  splash() {
    this.noise(0.35, 0.12, 'lowpass', 1100, 0.6, 0, 180);
  }

  victory() {
    const notes = [523, 659, 784, 1046, 1318, 1568];
    notes.forEach((n, i) => this.tone(n, 0.55, 'triangle', 0.075, i * 0.13));
    this.tone(1046, 1.2, 'sine', 0.06, 0.75);
    this.tone(1568, 1.2, 'sine', 0.045, 0.75);
  }

  gameover() {
    [330, 294, 262, 196].forEach((n, i) => this.tone(n, 0.5, 'triangle', 0.08, i * 0.18, n * 0.92));
  }

  click() {
    this.tone(720, 0.04, 'square', 0.025);
  }
}
