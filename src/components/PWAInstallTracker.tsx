'use client';
import { useEffect } from 'react';

export default function PWAInstallTracker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(display-mode: standalone)').matches) return;
    // Use localStorage for cross-session dedup (sessionStorage resets each session)
    const recorded = localStorage.getItem('kd_pwa_recorded');
    if (recorded) return;
    localStorage.setItem('kd_pwa_recorded', '1');
    const ua = navigator.userAgent;
    const platform = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop';
    fetch('/api/pwa/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform }),
    }).catch(() => {});
  }, []);
  return null;
}
