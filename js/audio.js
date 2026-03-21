/**
 * AudioEngine – Web Audio API music & SFX generator
 * All music is synthesised in-browser; no audio files required.
 */
class AudioEngine {
  constructor() {
    this.ctx        = null;
    this.master     = null;
    this.muted      = false;
    this.volume     = 0.38;
    this._sources   = []; // active oscillators for cleanup
    this._loopTimer = null;
  }

  // ── Initialise (must be called on a user gesture) ──────────────────────
  init() {
    if (this.ctx) return;
    this.ctx    = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ── Low-level note scheduler ────────────────────────────────────────────
  _note(freq, type, t0, dur, vol = 0.3, detune = 0) {
    if (!this.ctx || this.muted) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type          = type;
    osc.frequency.value = freq;
    osc.detune.value  = detune;
    osc.connect(gain);
    gain.connect(this.master);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.setValueAtTime(vol, t0 + dur * 0.75);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    this._sources.push(osc);
    return osc;
  }

  // Kick drum (sine thump)
  _kick(t0, vol = 0.5) {
    if (!this.ctx || this.muted) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t0);
    osc.frequency.exponentialRampToValueAtTime(30, t0 + 0.12);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t0); osc.stop(t0 + 0.2);
    this._sources.push(osc);
  }

  // Hi-hat (noise burst via oscillator detuning trick)
  _hihat(t0, vol = 0.06) {
    if (!this.ctx || this.muted) return;
    [2000,3000,4000,5000,6000].forEach(f => {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(vol / 5, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
      osc.connect(gain); gain.connect(this.master);
      osc.start(t0); osc.stop(t0 + 0.06);
      this._sources.push(osc);
    });
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────
  stopAll() {
    clearTimeout(this._loopTimer);
    this._sources.forEach(s => { try { s.stop(0); } catch (_) {} });
    this._sources = [];
  }

  // ── LOBBY MUSIC ─────────────────────────────────────────────────────────
  // Upbeat 16-bar loop in C major, BPM = 128
  playLobbyMusic() {
    if (this.muted) return;
    this.stopAll();
    const BPM  = 128;
    const B    = 60 / BPM;        // one beat
    const T    = this.ctx.currentTime + 0.05;

    // Note frequencies (C major)
    const C4=261.63, D4=293.66, E4=329.63, F4=349.23,
          G4=392.00, A4=440.00, B4=493.88,
          C5=523.25, D5=587.33, E5=659.25, G5=783.99, A5=880.00;

    // Melody (square wave, catchy hook)
    const mel = [
      [E5,0],[G5,1],[A5,1.5],[G5,2],[E5,2.5],[D5,3],
      [C5,4],[E5,5],[G5,5.5],[A5,6],[G5,7],
      [E5,8],[D5,9],[F4*2,9.5],[E5,10],[D5,10.5],[C5,11],
      [G4*2,12],[A4*2,13],[B4*2,13.5],[A4*2,14],[G4*2,15],
    ];
    mel.forEach(([f, beat]) =>
      this._note(f, 'square', T + beat * B, B * 0.82, 0.14)
    );

    // Counter-melody (triangle)
    const cml = [
      [C4,0,2],[G4,2,2],[A4,4,2],[F4,6,2],
      [C4,8,2],[G4,10,2],[A4,12,2],[G4,14,2]
    ];
    cml.forEach(([f, beat, dur]) =>
      this._note(f, 'triangle', T + beat * B, dur * B, 0.10)
    );

    // Bass line (triangle)
    const bas = [
      [C4/2,0],[C4/2,2],[G4/2,4],[G4/2,6],
      [A4/2,8],[A4/2,10],[F4/2,12],[G4/2,14]
    ];
    bas.forEach(([f, beat]) =>
      this._note(f, 'triangle', T + beat * B, B * 1.8, 0.22)
    );

    // Drums
    for (let i = 0; i < 16; i++) {
      this._kick(T + i * B, 0.4);
      if (i % 2 === 1) this._hihat(T + (i + 0.5) * B, 0.08);
    }

    const loopDur = 16 * B * 1000;
    this._loopTimer = setTimeout(() => this.playLobbyMusic(), loopDur);
  }

  // ── QUESTION COUNTDOWN MUSIC ────────────────────────────────────────────
  // Tense, rhythmic – plays for the full question time
  playQuestionMusic(seconds) {
    if (this.muted) return;
    this.stopAll();
    const BPM = 150;
    const B   = 60 / BPM;
    const T   = this.ctx.currentTime + 0.05;

    const G4=392, F4=349.23, E4=329.63, Eb4=311.13, D4=293.66, C4=261.63;
    const pattern = [G4, F4, G4, Eb4, G4, D4, G4, C4];
    const beats   = Math.min(Math.floor(seconds / B), 120);

    for (let i = 0; i < beats; i++) {
      const f = pattern[i % pattern.length];
      this._note(f, 'square', T + i * B, B * 0.55, 0.12);
      // bass on beat
      if (i % 4 === 0) this._note(f / 2, 'triangle', T + i * B, B * 0.9, 0.18);
      // kick every beat
      this._kick(T + i * B, 0.28);
    }
  }

  // ── SCOREBOARD MUSIC ────────────────────────────────────────────────────
  playScoreboard() {
    if (this.muted) return;
    this.stopAll();
    const T = this.ctx.currentTime + 0.05;
    const notes = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 440];
    notes.forEach((f, i) => {
      this._note(f,   'sine',   T + i * 0.18, 0.35, 0.18);
      this._note(f/2, 'triangle', T + i * 0.18, 0.35, 0.10);
    });
  }

  // ── SFX ─────────────────────────────────────────────────────────────────
  playCorrect() {
    if (this.muted) return;
    this.stopAll();
    const T = this.ctx.currentTime;
    // Bright ascending fanfare
    [[523.25,0],[659.25,.08],[783.99,.16],[1046.50,.24]].forEach(([f,t]) =>
      this._note(f, 'sine', T + t, 0.28, 0.35)
    );
    // Harmonics
    [[523.25,0],[659.25,.08],[783.99,.16],[1046.50,.24]].forEach(([f,t]) =>
      this._note(f * 2, 'sine', T + t, 0.2, 0.08)
    );
  }

  playWrong() {
    if (this.muted) return;
    this.stopAll();
    const T = this.ctx.currentTime;
    // Descending "wah-wah"
    [[330,.0],[260,.12],[200,.24],[160,.36]].forEach(([f,t]) =>
      this._note(f, 'sawtooth', T + t, 0.14, 0.22)
    );
  }

  playTimeout() {
    if (this.muted) return;
    this.stopAll();
    const T = this.ctx.currentTime;
    [[400,0],[350,.1],[300,.2]].forEach(([f,t]) =>
      this._note(f, 'sawtooth', T + t, 0.12, 0.2)
    );
  }

  playCountdownBeep(n) {
    if (this.muted) return;
    this.stopAll();
    const T = this.ctx.currentTime;
    const freq = n === 0 ? 880 : 660; // higher pitch on "GO!"
    this._note(freq, 'sine', T, 0.18, 0.5);
  }

  playWinner() {
    if (this.muted) return;
    this.stopAll();
    const T = this.ctx.currentTime;
    // Victory fanfare
    const fanfare = [
      [523.25, 0.00, 0.12],
      [523.25, 0.13, 0.12],
      [523.25, 0.26, 0.12],
      [415.30, 0.40, 0.28],
      [466.16, 0.70, 0.12],
      [523.25, 0.84, 0.50],
      [415.30, 1.38, 0.12],
      [466.16, 1.52, 0.12],
      [523.25, 1.66, 0.90],
    ];
    fanfare.forEach(([f, t, d]) => {
      this._note(f,   'square',   T + t, d, 0.26);
      this._note(f/2, 'triangle', T + t, d, 0.14);
    });
    // Kick on the final hit
    this._kick(T + 1.66, 0.5);
    this._kick(T + 1.80, 0.4);
    this._kick(T + 1.94, 0.5);
  }

  // ── Mute toggle ─────────────────────────────────────────────────────────
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.master.gain.value = 0;
      this.stopAll();
    } else {
      this.master.gain.value = this.volume;
    }
    return this.muted;
  }
}
