'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { isTossMode } from '@/lib/toss-mode';

/**
 * 통합 GuestNudge v2 — 단계적 회원가입 유도
 * 
 * ── 카운트 기준: 일간 세션 (하루 1회만 카운트) ──
 * 1~4일차: 없음 (신뢰 구축)
 * 5~7일차: 토스트 (5초 자동 소멸, 하루 1회)
 * 8~10일차: 하단 배너 (닫기 → 3일 쿨다운)
 * 11일차~: 소프트 모달 (닫기 → 24시간 쿨다운, 평생 20회 캡)
 * 
 * ── SEO 보호 ──
 * /blog/*, /apt/*, /stock/* 상세 → 토스트만 (모달·배너 금지)
 * / 랜딩 → 넛지 없음
 * 
 * ── 맥락 CTA 조율 ──
 * 피드 인라인 CTA, 블로그 하단 CTA가 뷰포트에 보이면 토스트 억제
 * 
 * ── 전환 추적 ──
 * 노출/클릭/닫기를 localStorage에 기록 → 어드민에서 조회 가능
 */

type NudgeType = 'none' | 'toast' | 'banner' | 'modal';

const S = {
  sessions: 'kd_nudge_sessions',
  bannerDismissed: 'kd_nudge_bd',
  modalDismissed: 'kd_nudge_md',
  lifetimeModals: 'kd_nudge_mn',
  stats: 'kd_nudge_stats',
} as const;

function isDetailPage(p: string) { return /^\/(blog|apt|stock)\/[^/]+/.test(p); }
function isExcludedPage(p: string) {
  return ['/', '/login', '/auth', '/onboarding', '/terms', '/privacy', '/admin', '/signup'].some(x => p === x || p.startsWith(x + '/'));
}

// 맥락 CTA(피드 인라인, 블로그 하단)가 뷰포트에 보이면 억제
function isContextCTAVisible(): boolean {
  for (const sel of ['[data-nudge="context-cta"]', '.kd-card-glow']) {
    const el = document.querySelector(sel);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) return true;
    }
  }
  return false;
}

// 일간 세션 카운터 (하루 1회만 증가)
function incrementSession(): number {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(S.sessions);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.lastDate === today) return d.count; // 같은 날 → 증가 안 함
      const c = (d.count || 0) + 1;
      localStorage.setItem(S.sessions, JSON.stringify({ count: c, lastDate: today }));
      return c;
    }
    localStorage.setItem(S.sessions, JSON.stringify({ count: 1, lastDate: today }));
    return 1;
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

function getNudgeType(sessions: number, detail: boolean): NudgeType {
  if (sessions < 5) return 'none';
  if (sessions <= 7) return 'toast';
  if (sessions <= 10) return detail ? 'toast' : 'banner';
  return detail ? 'toast' : 'modal';
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

    const sessions = incrementSession();
    const detail = isDetailPage(pathname);
    const type = getNudgeType(sessions, detail);
    if (type === 'none') return;

    // 토스트: 하루 1회만 (sessionStorage로 세션 내 중복 방지)
    const todayKey = `kd_nudge_t_${new Date().toISOString().slice(0, 10)}`;
    if (type === 'toast' && sessionStorage.getItem(todayKey)) return;

    // 배너 쿨다운 3일
    if (type === 'banner') {
      const d = localStorage.getItem(S.bannerDismissed);
      if (d && Date.now() - Number(d) < 3 * 86400000) return;
    }
    // 모달 쿨다운 24시간 + 평생 20회 캡
    if (type === 'modal') {
      const d = localStorage.getItem(S.modalDismissed);
      if (d && Date.now() - Number(d) < 86400000) return;
      if (parseInt(localStorage.getItem(S.lifetimeModals) || '0') >= 20) return;
    }

    const delay = type === 'toast' ? 3000 : 5000;
    const timer = setTimeout(() => {
      if (type === 'toast' && isContextCTAVisible()) return; // 맥락 CTA 보이면 억제
      setNudge(type);
      setVisible(true);
      track('impression', type);
      if (type === 'toast') {
        sessionStorage.setItem(todayKey, '1');
        setTimeout(() => setVisible(false), 5000);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [pathname, userId, loading]);

  if (!visible || nudge === 'none') return null;

  const url = `/login?redirect=${encodeURIComponent(pathname)}`;
  const onClick = () => track('click', nudge);

  if (nudge === 'toast') return (
    <div style={{ position:'fixed', bottom:'calc(70px + env(safe-area-inset-bottom,0px))', left:'50%', transform:'translateX(-50%)', zIndex:90, background:'var(--bg-elevated,#1e293b)', color:'var(--text-primary,#fff)', padding:'10px 20px', borderRadius:'var(--radius-card)', fontSize:'var(--fs-sm)', fontWeight:600, boxShadow:'0 4px 20px rgba(0,0,0,.3)', whiteSpace:'nowrap', animation:'fadeInUp .3s ease-out', display:'flex', alignItems:'center', gap:10 }}>
      <span>무료 가입하면 댓글·알림 OK</span>
      <Link href={url} onClick={onClick} style={{ background:'var(--brand)', color:'#fff', padding:'4px 12px', borderRadius:'var(--radius-sm)', fontSize:11, fontWeight:700, textDecoration:'none' }}>가입</Link>
    </div>
  );

  if (nudge === 'banner') return (
    <div style={{ position:'fixed', bottom:'calc(56px + env(safe-area-inset-bottom,0px))', left:0, right:0, zIndex:95, padding:'0 12px' }}>
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--brand-border,rgba(59,123,246,.3))', borderRadius:'var(--radius-card)', padding:'12px 14px', display:'flex', alignItems:'center', gap:'var(--sp-sm)', boxShadow:'0 4px 16px rgba(0,0,0,.25)' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>1,700+ 종목 알림 · 청약 마감 알림</div>
          <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:2 }}>카카오로 3초 무료 가입</div>
        </div>
        <Link href={url} onClick={onClick} style={{ background:'var(--brand)', color:'#fff', padding:'7px 16px', borderRadius:'var(--radius-sm)', fontSize:12, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>가입</Link>
        <button onClick={() => dismiss('banner')} style={{ background:'transparent', border:'none', color:'var(--text-tertiary)', fontSize:16, cursor:'pointer', padding:2, lineHeight:1 }} aria-label="닫기">×</button>
      </div>
    </div>
  );

  if (nudge === 'modal') return (
    <div style={{ position:'fixed', inset:0, zIndex:80, backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)', background:'rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-xl)', padding:'32px 28px', maxWidth:380, width:'100%', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ fontSize:36, marginBottom:'var(--sp-md)' }}>📊</div>
        <div style={{ fontSize:'var(--fs-lg)', fontWeight:800, color:'var(--text-primary)', marginBottom:'var(--sp-sm)' }}>더 많은 투자 정보를 받아보세요</div>
        <div style={{ fontSize:'var(--fs-sm)', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:'var(--sp-xl)' }}>주식 시세 알림 · 청약 마감 알림 · 실시간 토론<br/>무료로 모든 기능을 이용할 수 있어요</div>
        <Link href={url} onClick={onClick} style={{ display:'block', padding:'13px 0', borderRadius:'var(--radius-card)', background:'var(--kakao-bg,#FEE500)', color:'var(--kakao-text,#191919)', fontWeight:700, fontSize:'var(--fs-md)', textDecoration:'none', marginBottom:10 }}>카카오로 3초 가입</Link>
        <button onClick={() => dismiss('modal')} style={{ background:'none', border:'none', color:'var(--text-tertiary)', fontSize:'var(--fs-sm)', cursor:'pointer', padding:'8px 0' }}>나중에 할게요</button>
      </div>
    </div>
  );

  return null;
}
