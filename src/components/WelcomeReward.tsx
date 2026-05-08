'use client';
/**
 * WelcomeReward — 가입 직후 환영 토스트 + 100P 지급
 *
 * 작동 방식:
 * 1. userId가 있고 localStorage에 kd_welcomed가 없으면 = 첫 로그인
 * 2. /api/welcome-bonus POST → award_points RPC
 * 3. 토스트: "환영합니다! +100P 지급!"
 * 4. localStorage에 kd_welcomed 기록 → 다시 안 보임
 */
import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';

export default function WelcomeReward() {
  const { userId, loading } = useAuth();
  const { success } = useToast();

  useEffect(() => {
    if (loading || !userId) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('kd_welcomed')) return;

    // s258 P0: localStorage.setItem 을 fetch 성공 후로 이동.
    // 기존: fetch 호출 직전 무조건 set → fetch 실패 시 100P 영영 미지급 dead loop.
    // 변경: awarded 또는 already_awarded 일 때만 set. 네트워크/서버 실패는 재시도 가능.
    fetch('/api/welcome-bonus', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data?.awarded === true || data?.reason === 'already_awarded') {
          try { localStorage.setItem('kd_welcomed', '1'); } catch {}
        }
        if (data?.awarded) {
          success('환영합니다! 가입 보너스 100P가 지급됐어요 🎉');
        }
      })
      .catch(() => {});
  }, [userId, loading, success]);

  return null;
}
