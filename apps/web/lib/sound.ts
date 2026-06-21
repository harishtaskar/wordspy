/**
 * Tiny Web Audio synth engine — all sound is generated on the fly (no asset
 * files to ship or fetch). Safe in SSR/jsdom: every method no-ops when there is
 * no AudioContext. Browsers block audio until a user gesture, so the context is
 * created lazily and resumed on the first interaction.
 */

export type Sfx =
  | "click" // generic UI button
  | "pop" // chat message sent
  | "vote" // vote cast
  | "reveal" // role / result reveal
  | "win" // your side won
  | "lose" // your side lost
  | "join"; // someone entered

type Note = [freq: number, dur: number]; // dur in beats

// Playful, bouncy C-major hop — quick skipping notes with little leaps, the
// kind of cheerful loop you'd hear in a cartoony party game.
const MELODY: Note[] = [
  [523, 1], [659, 1], [784, 1], [659, 1], // C5 E5 G5 E5 — skip up
  [698, 1], [587, 1], [523, 2],           // F5 D5 C5 — settle
  [587, 1], [698, 1], [784, 1], [880, 1], // D5 F5 G5 A5 — climb
  [784, 1], [659, 1], [523, 2],           // G5 E5 C5 — land
  [659, 1], [523, 1], [659, 1], [784, 1], // E5 C5 E5 G5 — bounce
  [880, 1], [784, 1], [659, 2],           // A5 G5 E5 — wink
  [523, 1], [659, 1], [587, 1], [523, 2], // C5 E5 D5 C5 — resolve
];
const BEAT = 0.19; // seconds per beat — quick, springy tempo

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxEnabled = true;
  private musicEnabled = true;
  private musicOn = false;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private beatIndex = 0;

  /** Lazily build the audio graph; returns null when audio is unavailable. */
  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!this.ctx) {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.07;
      this.musicGain.connect(this.master);
    }
    return this.ctx;
  }

  /** Resume a suspended context — call from a user-gesture handler. */
  resume(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  setSfxEnabled(v: boolean): void {
    this.sfxEnabled = v;
  }

  setMusicEnabled(v: boolean): void {
    this.musicEnabled = v;
    if (!v) this.stopMusic();
    else if (this.musicOn) this.startMusic();
  }

  private blip(ctx: AudioContext, freq: number, dur: number, type: OscillatorType, when = 0, gain = 0.5): void {
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** One-shot effect. Ignored when SFX are off or audio is unavailable. */
  play(name: Sfx): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    switch (name) {
      case "click":
        this.blip(ctx, 660, 0.07, "square", 0, 0.35);
        break;
      case "pop":
        this.blip(ctx, 880, 0.06, "sine", 0, 0.4);
        break;
      case "vote":
        this.blip(ctx, 520, 0.08, "triangle", 0, 0.4);
        this.blip(ctx, 780, 0.1, "triangle", 0.07, 0.4);
        break;
      case "reveal":
        this.blip(ctx, 330, 0.12, "sawtooth", 0, 0.3);
        this.blip(ctx, 494, 0.12, "sawtooth", 0.1, 0.3);
        this.blip(ctx, 660, 0.16, "sawtooth", 0.2, 0.3);
        break;
      case "win":
        [523, 659, 784, 1047].forEach((f, i) => this.blip(ctx, f, 0.18, "square", i * 0.12, 0.4));
        break;
      case "lose":
        [440, 392, 330, 247].forEach((f, i) => this.blip(ctx, f, 0.2, "sawtooth", i * 0.13, 0.35));
        break;
      case "join":
        this.blip(ctx, 587, 0.08, "sine", 0, 0.35);
        this.blip(ctx, 880, 0.1, "sine", 0.08, 0.35);
        break;
    }
  }

  /** Begin (or restart) the looping background melody. */
  startMusic(): void {
    this.musicOn = true;
    if (!this.musicEnabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    if (this.musicTimer) return; // already scheduling
    this.beatIndex = 0;
    this.scheduleNextNote();
  }

  private scheduleNextNote(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || !this.musicEnabled) {
      this.musicTimer = null;
      return;
    }
    const [freq, beats] = MELODY[this.beatIndex % MELODY.length]!;
    const dur = beats * BEAT;
    const t0 = ctx.currentTime + 0.02;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    // Plucky triangle: snappy attack + short decay so each note pops and leaves
    // a little gap — that staccato bounce is what makes it feel playful.
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.8, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.6);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + dur);
    this.beatIndex += 1;
    this.musicTimer = setTimeout(() => this.scheduleNextNote(), dur * 1000);
  }

  stopMusic(): void {
    this.musicOn = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

/** Process-wide singleton; importing it never touches Web Audio until used. */
export const sound = new SoundEngine();

/** Convenience for the common case. */
export const playSfx = (name: Sfx) => sound.play(name);
