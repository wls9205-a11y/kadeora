export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (typeof window === 'undefined') return;
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(style === 'heavy' ? [15, 5, 15] : style === 'medium' ? 12 : 6);
    }
  } catch {}
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const len = Math.round(ctx.sampleRate * (style === 'heavy' ? 0.03 : style === 'medium' ? 0.02 : 0.01));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const amp = style === 'heavy' ? 0.9 : style === 'medium' ? 0.6 : 0.35;
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * amp * (1 - i / len);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.001;
    src.buffer = buf;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
    src.onended = () => { try { ctx.close(); } catch {} };
  } catch {}
}
