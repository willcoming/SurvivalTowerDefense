import type { VisualEvent } from '../sim/types';

/** Original synthesized score. Only presentation uses this clock. */
export class GameAudio {
  private context: AudioContext | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private mode: 'lobby' | 'battle' | 'boss' = 'lobby';
  private enabled = true;
  private voices = new Set<{ oscillator: OscillatorNode; gain: GainNode; priority: number }>();
  private lastSound = new Map<string, number>();
  musicVolume = .22;
  sfxVolume = .45;
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.music = this.context.createGain(); this.effects = this.context.createGain();
      this.music.connect(this.context.destination); this.effects.connect(this.context.destination);
      this.volumes(this.musicVolume, this.sfxVolume);
      this.timer = setInterval(() => this.beat(), 180);
    }
    if (this.context.state === 'suspended' && this.enabled) await this.context.resume();
  }
  volumes(music: number, effects: number) {
    this.musicVolume = music; this.sfxVolume = effects;
    if (this.music) this.music.gain.value = music * .19;
    if (this.effects) this.effects.gain.value = effects * .18;
  }
  setMode(mode: 'lobby' | 'battle' | 'boss') { if (mode !== this.mode) { this.mode = mode; this.step = 0; } }
  setActive(active: boolean) { this.enabled = active; if (this.context) void (active ? this.context.resume() : this.context.suspend()); }
  private tone(hz: number, length: number, volume: number, type: OscillatorType, output: GainNode | null, endHz?: number, priority = 0) {
    if (!this.context || !output || !this.enabled) return;
    if (this.voices.size >= 16) {
      const quietest = [...this.voices].sort((a, b) => a.priority - b.priority)[0];
      if (quietest.priority >= priority) return;
      quietest.oscillator.stop(); quietest.oscillator.disconnect(); quietest.gain.disconnect(); this.voices.delete(quietest);
    }
    const now = this.context.currentTime; const oscillator = this.context.createOscillator(); const gain = this.context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(hz, now);
    if (endHz) oscillator.frequency.exponentialRampToValueAtTime(endHz, now + length);
    gain.gain.setValueAtTime(.001, now); gain.gain.exponentialRampToValueAtTime(Math.max(.002, volume), now + .008); gain.gain.exponentialRampToValueAtTime(.001, now + length);
    oscillator.connect(gain); gain.connect(output); oscillator.start(); oscillator.stop(now + length + .03);
    const voice = { oscillator, gain, priority }; this.voices.add(voice);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(voice); };
  }
  private beat() {
    if (!this.context || !this.enabled || this.context.state !== 'running') return;
    const melodies = { lobby: [0, 7, 12, 16, 14, 7, 4, 12, 0, 7, 11, 14, 12, 7, 4, 2], battle: [0, 12, 7, 15, 14, 7, 10, 12, 0, 7, 12, 19, 15, 14, 10, 7], boss: [0, 1, 7, 12, 0, 3, 7, 13, 0, 1, 7, 12, 10, 7, 3, 1] };
    const root = this.mode === 'lobby' ? 220 : this.mode === 'boss' ? 146.83 : 196;
    const note = melodies[this.mode][this.step % 16];
    this.tone(root * 2 ** (note / 12), .21, this.mode === 'lobby' ? .20 : .12, 'triangle', this.music);
    if (this.step % 4 === 0) this.tone(root / 2, .55, .34, 'sine', this.music);
    if (this.mode !== 'lobby' && this.step % 2 === 0) this.tone(95, .09, .34, 'sine', this.music, 32);
    if (this.mode !== 'lobby' && this.step % 4 === 2) this.tone(1800, .025, .035, 'triangle', this.music, 320);
    this.step++;
  }
  private eligible(key: string) { const now = performance.now(); if (now - (this.lastSound.get(key) ?? -Infinity) < 50) return false; this.lastSound.set(key, now); return true; }
  feedback(kind: 'choose' | 'start' | 'win' | 'lose' | 'ready' | 'alert' | 'shield-break' | 'evolution' | 'cast') {
    if (!this.eligible(kind)) return;
    if (kind === 'alert') { this.tone(740, .12, .30, 'square', this.effects, 530, 3); return; }
    if (kind === 'shield-break') { this.tone(1450, .18, .18, 'sawtooth', this.effects, 180, 2); return; }
    if (kind === 'ready') { this.tone(880, .22, .20, 'sine', this.effects, 1320, 2); return; }
    if (kind === 'cast') { this.tone(260, .30, .25, 'triangle', this.effects, 1040, 3); return; }
    const intervals = kind === 'lose' ? [7, 3, 0] : kind === 'evolution' ? [0, 7, 12, 19] : kind === 'win' ? [0, 4, 7, 12] : [0, 4, 7];
    intervals.forEach((n, i) => setTimeout(() => this.tone((kind === 'lose' ? 180 : 440) * 2 ** (n / 12), .15, .22, 'triangle', this.effects, undefined, 2), i * 65));
  }
  event(event: VisualEvent) {
    if (!this.eligible(`${event.kind}:${event.source ?? ''}`)) return;
    if (event.kind === 'shot') this.tone(event.source === 'C05' ? 120 : 850, .07, .07, event.source === 'C05' ? 'triangle' : 'sine', this.effects, event.source === 'C05' ? 45 : 220, 1);
    if (event.kind === 'arc' || (event.kind === 'beam' && event.source === 'C02')) this.tone(1200, .06, .035, 'sawtooth', this.effects, 280, 1);
    if (event.kind === 'beam' && event.source === 'C03') this.tone(230, .10, .12, 'triangle', this.effects, 48, 1);
    if (event.kind === 'beam' && event.source === 'C06') this.tone(1650, .06, .05, 'sine', this.effects, 890, 1);
    if (event.kind === 'explosion') this.tone(event.source === 'C04' ? 360 : 140, event.source === 'C04' ? .3 : .18, .12, event.source === 'C04' ? 'sine' : 'sawtooth', this.effects, event.source === 'C04' ? 90 : 25, 1);
    if (event.kind === 'hit') this.tone(480, .025, .025, 'triangle', this.effects, 210, 1);
    if (event.kind === 'death') this.tone(180, .11, .07, 'triangle', this.effects, 55, 1);
    if (event.kind === 'shield') this.tone(600, .20, .10, 'sine', this.effects, 900, 2);
    if (event.kind === 'wall-hit') this.tone(70, .22, .2, 'square', this.effects, 30, 3);
    if (event.kind === 'interrupt') this.tone(1100, .08, .17, 'triangle', this.effects, 1600, 3);
    if (event.kind === 'evolution') this.feedback('evolution');
    if (event.kind === 'tactical') this.feedback('cast');
  }
  destroy() { if (this.timer) clearInterval(this.timer); this.voices.forEach(v => v.oscillator.stop()); this.voices.clear(); void this.context?.close(); }
  stats() { return { voices: this.voices.size, contextState: this.context?.state ?? 'locked', loop: this.mode, musicVolume: this.musicVolume, sfxVolume: this.sfxVolume }; }
}
