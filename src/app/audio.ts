/** Buzzer sound for the simulator (Web Audio square wave). */
let ctx: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let gain: GainNode | null = null;

/** Create the audio context; must be called from a user gesture (e.g. Run). */
export function unlockAudio() {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
  }
  void ctx.resume();
}

export function playNote(midi: number | null) {
  if (!ctx) return;
  if (midi === null) {
    gain?.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
    return;
  }
  if (!osc) {
    osc = ctx.createOscillator();
    gain = ctx.createGain();
    osc.type = 'square';
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
  }
  osc.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), ctx.currentTime);
  gain!.gain.setTargetAtTime(0.06, ctx.currentTime, 0.005);
}
