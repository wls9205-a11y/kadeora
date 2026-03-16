import { useCallback } from 'react';

type Pat = 'light'|'medium'|'heavy'|'success'|'error';
const PATS: Record<Pat, number|number[]> = {
  light: 10, medium: 20, heavy: 35,
  success: [10,50,10], error: [30,40,30],
};

export function useHaptic() {
  const vibrate = useCallback((p: Pat = 'light') => {
    try { if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(PATS[p]); } catch {}
  }, []);
  const haptic = useCallback(() => vibrate('light'), [vibrate]);
  const hapticSuccess = useCallback(() => vibrate('success'), [vibrate]);
  const hapticError = useCallback(() => vibrate('error'), [vibrate]);
  return { haptic, hapticSuccess, hapticError, vibrate };
}
