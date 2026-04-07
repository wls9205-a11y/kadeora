'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { isTossMode } from '@/lib/toss-mode';
import { trackConversion } from '@/lib/track-conversion';

/**
 * 통합 GuestNudge v5 — 첫방문 + 재방문 모두 지원
 * 
 * ── 카운트 기준: 페이지뷰 (세션 내 누적) ──
 * 첫방문: 2~3PV → 배너, 5PV+ → 모달
 * 재방문: 2~3PV → 토스트, 4~5PV → 배너, 6PV+ → 모달
 * 
 * ── SEO 보호 ──
 * /blog/*, /apt/*, /stock/* 상세 → 토스트만 (모달·배너 금지)
 * / 랜딩 → 넛지 없음
 */

type NudgeType = 'none' | 'toast' | 'banner' | 'modal';

const S = {
  pageviews: 'kd_nudge_pv',
  bannerDismissed: 'kd_nudge_bd',
  modalDismissed: 'kd_nudge_md',
  lifetimeModals: 'kd_nudge_mn',
  stats: 'kd_nudge_stats',
} as const;

function isDetailPage(p: string) { return /^\/(blog|apt|stock)\/[^/]+/.test(p); }
function isExcludedPage(p: string) {
  return ['/', '/login', '/auth', '/onboarding', '/terms', '/privacy', '/admin', '/signup'].some(x => p === x || p.startsWith(x + '/'));
}

function isContextCTAVisible(): boolean {
  for (const sel of ['[data-nudge="context-cta"]', '.kd-card-glow', '[data-gate="content"]']) {
    const el = document.querySelector(sel);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) return true;
    }
  }
  return false;
}

function incrementPageview(): number {
  try {
    const n = parseInt(localStorage.getItem(S.pageviews) || '0') + 1;
    localStorage.setItem(S.pageviews, String(n));
    return n;
  } catch { return 1; }
}

function track(action: 'impression' | 'click' | 'dismiss', type: NudgeType) {
  try {
    const raw = localStorage.getItem(S.stats);
    const s = raw ? JSON.parse(raw) : { impressions: 0, clicks: 0, dismisses: 0 };
    if (action === 'impression') s.impressions++;
    else if (action === 'click') s.clicks++;
    else s.dismisses++;
    s.last = `${action}:${type}:${new Date().toISOString()}`;
    localStorage.setItem(S.stats, JSON.stringify(s));
  } catch {}
}

function getNudgeType(pv: number, detail: boolean): NudgeType {
  // v6: 1PV부터 트리거 — 97.5%가 1PV에서 이탈하므로
  const sessions = typeof window !== 'undefined' ? localStorage.getItem('kd_visit_sessions') : null;
  const isReturnVisitor = sessions ? (() => { try { return JSON.parse(sessions).length >= 2; } catch { return false; } })() : false;

  if (isReturnVisitor) {
    if (pv <= 2) return 'toast';
    if (pv <= 4) return detail ? 'toast' : 'banner';
    return detail ? 'toast' : 'modal';
  } else {
    // 첫방문자: 1PV → 토스트, 2PV → 배너, 4PV+ → 모달
    if (pv <= 1) return 'toast';
    if (pv <= 3) return detail ? 'toast' : 'banner';
    return detail ? 'toast' : 'modal';
  }
}

export default function GuestNudge() {
  const [nudge, setNudge] = useState<NudgeType>('none');
  const [visible, setVisible] = useState(false);
  const { userId, loading } = useAuth();
  const pathname = usePathname();

  const dismiss = useCallback((type: 'banner' | 'modal') => {
    setVisible(false);
    track('dismiss', type);
    if (type === 'banner') localStorage.setItem(S.bannerDismissed, String(Date.now()));
    else {
      localStorage.setItem(S.modalDismissed, String(Date.now()));
      const n = parseInt(localStorage.getItem(S.lifetimeModals) || '0') + 1;
      localStorage.setItem(S.lifetimeModals, String(n));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || loading || userId || isTossMode()) return;
    if (isExcludedPage(pathname)) return;

    const pv = incrementPageview();
    const detail = isDetailPage(pathname);
    const type = getNudgeType(pv, detail);
    if (type === 'none') return;

    // 토스트: 세션당 1회
    const toastKey = 'kd_nudge_toast_shown';
    if (type === 'toast' && sessionStorage.getItem(toastKey)) return;

    // 배너 쿨다운 1일
    if (type === 'banner') {
      const d = localStorage.getItem(S.bannerDismissed);
      if (d && Date.now() - Number(d) < 86400000) return;
    }
    // 모달 쿨다운 6시간 + 평생 20회 캡
    if (type === 'modal') {
      const d = localStorage.getItem(S.modalDismissed);
      if (d && Date.now() - Number(d) < 6 * 3600000) return;
      if (parseInt(localStorage.getItem(S.lifetimeModals) || '0') >= 20) return;
    }

    // v6: 1PV 토스트는 15초 지연 (콘텐츠 읽을 시간), 나머지 기존 유지
    const delay = type === 'toast' ? (pv <= 1 ? 15000 : 2000) : 3000;
    const timer = setTimeout(() => {
      if (type === 'toast' && isContextCTAVisible()) return;
      setNudge(type);
      setVisible(true);
      track('impression', type);
      trackConversion('cta_view', `guest_nudge_${type}`);
      if (type === 'toast') {
        sessionStorage.setItem(toastKey, '1');
        setTimeout(() => setVisible(false), 5000);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [pathname, userId, loading]);

  if (!visible || nudge === 'none') return null;

  const url = `/login?redirect=${encodeURIComponent(pathname)}`;
  const onClick = () => track('click', nudge);

  // 맥락별 CTA 메시지
  const isApt = pathname.startsWith('/apt');
  const isStock = pathname.startsWith('/stock');
  const isBlog = pathname.startsWith('/blog');
  const ctaMain = isApt ? '청약 마감 알림 · 분양가 비교' : isStock ? '종목 급등 알림 · AI 분석' : isBlog ? '매일 AI 투자 분석 리포트' : '주식 알림 · 청약 알림 · 실시간 토론';
  const ctaSub = '카카오 3초 무료 가입';

  if (nudge === 'toast') return (
    <div style={{ position:'fixed', bottom:'calc(70px + env(safe-area-inset-bottom,0px))', left:'50%', transform:'translateX(-50%)', zIndex:90, background:'var(--bg-elevated,#1e293b)', color:'var(--text-primary,#fff)', padding:'10px 20px', borderRadius:'var(--radius-card)', fontSize:'var(--fs-sm)', fontWeight:600, boxShadow:'0 4px 20px rgba(0,0,0,.3)', whiteSpace:'nowrap', animation:'fadeInUp .3s ease-out', display:'flex', alignItems:'center', gap:10 }}>
      <span>{ctaMain}</span>
      <Link href={url} onClick={onClick} style={{ background:'var(--brand)', color:'#fff', padding:'4px 12px', borderRadius:'var(--radius-sm)', fontSize:11, fontWeight:700, textDecoration:'none' }}>가입</Link>
    </div>
  );

  if (nudge === 'banner') return (
    <div style={{ position:'fixed', bottom:'calc(56px + env(safe-area-inset-bottom,0px))', left:0, right:0, zIndex:95, padding:'0 12px' }}>
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--brand-border,rgba(59,123,246,.3))', borderRadius:'var(--radius-card)', padding:'12px 14px', display:'flex', alignItems:'center', gap:'var(--sp-sm)', boxShadow:'0 4px 16px rgba(0,0,0,.25)' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{ctaMain}</div>
          <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>{ctaSub}</div>
        </div>
        <Link href={url} onClick={onClick} style={{ background:'var(--brand)', color:'#fff', padding:'7px 16px', borderRadius:'var(--radius-sm)', fontSize:12, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>가입</Link>
        <button onClick={() => dismiss('banner')} style={{ background:'transparent', border:'none', color:'var(--text-tertiary)', fontSize:16, cursor:'pointer', padding:2, lineHeight:1 }} aria-label="닫기">×</button>
      </div>
    </div>
  );

  if (nudge === 'modal') return (
    <div style={{ position:'fixed', inset:0, zIndex:80, backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)', background:'rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-xl)', padding:'32px 28px', maxWidth:380, width:'100%', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ fontSize:36, marginBottom:'var(--sp-md)' }}>{isApt ? '🏠' : isStock ? '📈' : '📊'}</div>
        <div style={{ fontSize:'var(--fs-lg)', fontWeight:800, color:'var(--text-primary)', marginBottom:'var(--sp-sm)' }}>{ctaMain}</div>
        <div style={{ fontSize:'var(--fs-sm)', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:'var(--sp-xl)' }}>가입하면 모든 기능을 무료로 이용할 수 있어요<br/>✓ 알림 ✓ 관심등록 ✓ 댓글 ✓ 포인트</div>
        <Link href={url} onClick={onClick} style={{ display:'block', padding:'13px 0', borderRadius:'var(--radius-card)', background:'var(--kakao-bg,#FEE500)', color:'var(--kakao-text,#191919)', fontWeight:700, fontSize:'var(--fs-md)', textDecoration:'none', marginBottom:10 }}>카카오로 3초 가입</Link>
        <button onClick={() => dismiss('modal')} style={{ background:'none', border:'none', color:'var(--text-tertiary)', fontSize:'var(--fs-sm)', cursor:'pointer', padding:'8px 0' }}>나중에 할게요</button>
      </div>
    </div>
  );

  return null;
}
