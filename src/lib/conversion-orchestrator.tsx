'use client';
/**
 * ConversionOrchestrator — CTA 중앙 관리 시스템
 *
 * 문제: 12개 CTA 컴포넌트가 각자 localStorage로 무조율 동작
 * 해결: 한 시점에 최대 2개 CTA + 닫으면 30분 쿨다운 + 우선순위
 *
 * 우선순위 (높을수록 먼저):
 * 10 - SmartSectionGate (인라인, 항상 표시 — 오케스트레이터 관리 밖)
 *  8 - TwoStepCTA (글 하단, 맥락별 질문)
 *  6 - BlogFloatingCTA (하단 플로팅)
 *  4 - NewsletterSubscribe (이메일 수집)
 *  2 - ExitIntentPopup, GuestNudge, SignupNudge, AutoPushPrompt
 *  1 - BlogTopBanner, BlogMidCTA, ReturnVisitorBanner
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

const MAX_VISIBLE = 2;
const COOLDOWN_MS = 30 * 60 * 1000; // 30분
const STORAGE_KEY = 'kd_cta_state';

interface CtaState {
  visible: string[];           // 현재 표시 중인 CTA id
  dismissed: Record<string, number>; // id → dismiss timestamp
}

interface OrchestratorContext {
  canShow: (id: string, priority?: number) => boolean;
  onShow: (id: string) => void;
  onDismiss: (id: string) => void;
}

const Ctx = createContext<OrchestratorContext>({
  canShow: () => true,
  onShow: () => {},
  onDismiss: () => {},
});

export function useConversion(id: string, priority = 1) {
  const ctx = useContext(Ctx);
  return {
    canShow: ctx.canShow(id, priority),
    onShow: () => ctx.onShow(id),
    onDismiss: () => ctx.onDismiss(id),
  };
}

function loadState(): CtaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { visible: [], dismissed: {} };
    const parsed = JSON.parse(raw);
    // 만료된 쿨다운 정리
    const now = Date.now();
    const dismissed: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed.dismissed || {})) {
      if (typeof v === 'number' && now - v < COOLDOWN_MS) dismissed[k] = v;
    }
    return { visible: [], dismissed };
  } catch { return { visible: [], dismissed: {} }; }
}

function saveState(state: CtaState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissed: state.dismissed }));
  } catch { /* quota exceeded etc */ }
}

export function ConversionOrchestratorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CtaState>({ visible: [], dismissed: {} });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setState(loadState());
    setMounted(true);
  }, []);

  const canShow = useCallback((id: string, _priority = 1): boolean => {
    if (!mounted) return false;
    // 쿨다운 체크
    const dismissedAt = state.dismissed[id];
    if (dismissedAt && Date.now() - dismissedAt < COOLDOWN_MS) return false;
    // 최대 표시 수 체크
    if (state.visible.length >= MAX_VISIBLE && !state.visible.includes(id)) return false;
    return true;
  }, [mounted, state]);

  const onShow = useCallback((id: string) => {
    setState(prev => {
      if (prev.visible.includes(id)) return prev;
      return { ...prev, visible: [...prev.visible, id].slice(-MAX_VISIBLE) };
    });
  }, []);

  const onDismiss = useCallback((id: string) => {
    setState(prev => {
      const next: CtaState = {
        visible: prev.visible.filter(v => v !== id),
        dismissed: { ...prev.dismissed, [id]: Date.now() },
      };
      saveState(next);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ canShow, onShow, onDismiss }}>{children}</Ctx.Provider>;
}
