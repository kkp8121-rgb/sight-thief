const clamp = (value) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .24;
const CUES = {
  select: [[392, 0, .12, .025], [523.25, .07, .15, .017]],
  watch: [[220, 0, .24, .02], [329.63, .12, .32, .018]],
  discovered: [[392, 0, .25, .03], [493.88, .11, .32, .025], [659.25, .22, .52, .022]],
  collected: [[523.25, 0, .22, .028], [659.25, .12, .28, .024], [783.99, .24, .5, .02]],
  denied: [[164.81, 0, .14, .02], [130.81, .1, .22, .014]],
  win: [[261.63, 0, .3, .025], [329.63, .12, .38, .022], [392, .24, .48, .02], [523.25, .36, .7, .023]],
  lose: [[293.66, 0, .28, .02], [246.94, .16, .4, .016], [196, .32, .62, .013]]
};
const BED = [[196, 246.94, 293.66], [220, 277.18, 329.63], [174.61, 220, 261.63], [164.81, 207.65, 246.94]];

function AudioCtor() { return globalThis.AudioContext || globalThis.webkitAudioContext || globalThis.window?.AudioContext || globalThis.window?.webkitAudioContext || null; }

export function createAudio() {
  let context = null, master = null, timer = null, next = 0, step = 0, volume = .24, muted = false, started = false, paused = false, disposed = false, footTime = 0, guardTime = 0, alertTime = 0;
  const active = new Set();
  const setMaster = () => { if (!master?.gain) return; const value = muted ? 0 : volume, now = context?.currentTime || 0; try { master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(value, now, .025); } catch (_) { master.gain.value = value; } };
  const keep = (source) => { active.add(source); source.addEventListener?.('ended', () => { active.delete(source); try { source.disconnect(); } catch (_) {} }, { once: true }); return source; };
  const tone = (frequency, when, duration = .2, level = .02, waveform = 'sine') => { if (!context || !master || muted || volume <= 0) return false; try { const oscillator = context.createOscillator(), envelope = context.createGain(); oscillator.type = waveform; oscillator.frequency.setValueAtTime(frequency, when); envelope.gain.setValueAtTime(.0001, when); envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, level), when + .012); envelope.gain.exponentialRampToValueAtTime(.0001, when + Math.max(.04, duration)); oscillator.connect(envelope); envelope.connect(master); keep(oscillator).start(when); oscillator.stop(when + duration + .035); return true; } catch (_) { return false; } };
  const tick = () => { if (!context || !started || paused) return; const now = context.currentTime; if (!next || next < now - .5) next = now + .03; while (next < now + .22) { const chord = BED[Math.floor(step / 8) % BED.length]; tone(chord[step % chord.length], next, .38, .009, 'triangle'); if (step % 4 === 0) tone(chord[1] * 2, next + .06, .18, .004, 'sine'); step++; next += .62; } };
  const ensure = async () => { if (disposed) return false; if (!context) { const Ctor = AudioCtor(); if (!Ctor) return false; try { context = new Ctor(); master = context.createGain(); master.gain.value = muted ? 0 : volume; master.connect(context.destination); } catch (_) { context = null; master = null; return false; } } try { if (context.state === 'suspended') await context.resume(); } catch (_) { return false; } return !disposed && !!context && context.state !== 'closed'; };
  const unlock = async () => ensure();
  const setVolume = (value) => { volume = clamp(Number(value)); setMaster(); return volume; };
  const setMuted = (value) => { muted = !!value; setMaster(); return muted; };
  const start = async () => { if (!(await ensure()) || disposed || !context) return false; started = true; paused = false; next = next || context.currentTime + .04; if (timer == null) timer = setInterval(tick, 90); tick(); return true; };
  const pause = () => { if (!context) return false; paused = true; if (timer != null) { clearInterval(timer); timer = null; } try { context.suspend?.(); } catch (_) {} return true; };
  const resume = async () => { if (!context || !started) return false; try { await context.resume?.(); } catch (_) { return false; } paused = false; if (timer == null) timer = setInterval(tick, 90); tick(); return true; };
  const stop = () => { started = false; paused = false; next = 0; step = 0; footTime = 0; guardTime = 0; alertTime = 0; if (timer != null) { clearInterval(timer); timer = null; } for (const source of active) { try { source.stop?.(); } catch (_) {} try { source.disconnect?.(); } catch (_) {} } active.clear(); return true; };
  const play = (name) => { if (!context || !master || muted || volume <= 0 || paused) return false; const cue = CUES[name]; if (!cue) return false; const now = context.currentTime + .01; cue.forEach(([frequency, offset, duration, level]) => tone(frequency, now + offset, duration, level, name === 'denied' ? 'square' : 'sine')); return true; };
  const update = (run, dt = 0) => { if (!started || paused || !context || !run) return; const delta = Math.max(0, Math.min(.1, Number(dt) || 0)); footTime -= delta; guardTime -= delta; alertTime -= delta; if (run.player?.moving && !run.watching && footTime <= 0) { tone(88, context.currentTime + .01, .055, .012, 'triangle'); footTime = run.player.crouching ? .65 : .4; } const nearby = (run.guards || []).some((guard) => Math.hypot((guard.x || 0) - (run.player?.x || 0), (guard.z || 0) - (run.player?.z || 0)) < 7); if (nearby && guardTime <= 0) { tone(132, context.currentTime + .01, .08, .008, 'sine'); guardTime = .72; } if ((run.suspicion || 0) > .38 && alertTime <= 0) { tone(180 + (run.suspicion || 0) * 80, context.currentTime + .01, .12, .009, 'sine'); alertTime = .62; } };
  const dispose = () => { if (disposed) return; stop(); disposed = true; try { master?.disconnect(); } catch (_) {} try { context?.close?.(); } catch (_) {} context = null; master = null; };
  return { unlock, setVolume, setMuted, start, pause, resume, stop, play, update, dispose };
}
