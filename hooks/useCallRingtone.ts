import { useCallback, useEffect, useRef, useState } from 'react';

/** Foreground ringing only. iOS needs its audio context unlocked by a gesture;
 * this deliberately does not claim to replace PushKit/CallKit background calls. */
export function useCallRingtone(incoming: boolean) {
  const context = useRef<AudioContext | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const enable = useCallback(async () => {
    try {
      context.current ||= new AudioContext();
      if (context.current.state !== 'running') await context.current.resume();
      setUnlocked(context.current.state === 'running');
      setBlocked(context.current.state !== 'running');
    } catch { setBlocked(true); }
  }, []);
  useEffect(() => {
    // Prime once the user interacts with the app, before the next incoming call.
    const prime = () => { if (!context.current || context.current.state !== 'running') void enable(); };
    document.addEventListener('pointerdown', prime, { passive: true });
    document.addEventListener('keydown', prime);
    return () => { document.removeEventListener('pointerdown', prime); document.removeEventListener('keydown', prime); void context.current?.close(); };
  }, [enable]);
  useEffect(() => {
    if (!incoming) { setBlocked(false); return; }
    const audio = context.current;
    if (!audio || audio.state !== 'running') { setBlocked(true); return; }
    setBlocked(false);
    const notes = new Set<OscillatorNode>();
    const ring = () => {
      if (audio.state !== 'running') { setBlocked(true); return; }
      for (const offset of [0, .42]) for (const [frequency, level] of [[523.25, .09], [659.25, .035]]) {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        const start = audio.currentTime + offset;
        oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(level, start + .015);
        gain.gain.setValueAtTime(level, start + .2); gain.gain.linearRampToValueAtTime(0, start + .28);
        oscillator.connect(gain).connect(audio.destination); notes.add(oscillator);
        oscillator.onended = () => { notes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start); oscillator.stop(start + .3);
      }
    };
    ring(); const timer = setInterval(ring, 3000);
    return () => { clearInterval(timer); notes.forEach(note => { try { note.stop(); } catch {} }); };
  }, [incoming, unlocked]);
  return { blocked, enable };
}
