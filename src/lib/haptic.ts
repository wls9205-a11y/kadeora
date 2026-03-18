export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(style === 'heavy' ? [15, 5, 15] : style === 'medium' ? 10 : 5);
    }
  } catch {}
}
