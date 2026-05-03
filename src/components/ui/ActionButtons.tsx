'use client';

/**
 * s215 통일 액션 컴포넌트 라이브러리
 *
 * 카더라 전역에서 반복되는 액션을 단일 컴포넌트로 통합.
 *
 * - <WatchButton/>   관심 등록 (apt 단지·stock 종목·재개발 공통)
 * - <ShareButton/>   공유 (아이콘/텍스트/카톡 3변형)
 * - <NotifyButton/>  알림 (비로그인/로그인/완료 3상태)
 * - <SeeAllLink/>    더보기/전체 (카드/탭/게이트 3변형)
 * - <FormActions/>   폼 푸터 (이전/다음/완료/취소)
 *
 * Architecture Rule #19 — 위 액션은 인라인 style 로 직접 구현 금지.
 */

import Link from 'next/link';

/* ===== <WatchButton/> ===== */

type WatchDomain = 'apt' | 'stock' | 'redev';

const DOMAIN_LABEL: Record<WatchDomain, string> = {
  apt: '단지',
  stock: '종목',
  redev: '구역',
};

interface WatchButtonProps {
  domain: WatchDomain;
  watched: boolean;
  loading?: boolean;
  onClick: () => void;
  variant?: 'cta' | 'inline' | 'icon';
  pointReward?: number;
}

export function WatchButton({ domain, watched, loading, onClick, variant = 'inline', pointReward }: WatchButtonProps) {
  const label = DOMAIN_LABEL[domain];

  if (variant === 'icon') {
    return (
      <button type="button" onClick={onClick} disabled={loading}
        aria-label={watched ? `관심 ${label} 해제` : `관심 ${label} 등록`}
        style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, border: watched ? '1px solid var(--accent-yellow)' : '1px solid var(--border)', background: watched ? 'var(--accent-yellow-bg)' : 'var(--bg-surface)', color: watched ? 'var(--accent-yellow)' : 'var(--text-tertiary)', fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'var(--transition-fast)' }}>
        {watched ? '★' : '☆'}
      </button>
    );
  }

  if (variant === 'cta') {
    return (
      <button type="button" onClick={onClick} disabled={loading}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: watched ? '1px solid var(--brand)' : 'none', background: watched ? 'transparent' : 'var(--brand)', color: watched ? 'var(--brand)' : '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'var(--transition-fast)' }}>
        <span style={{ fontSize: 16 }}>{watched ? '★' : '☆'}</span>
        <span>{watched ? `관심 ${label} 등록됨` : `관심 ${label} 등록`}</span>
        {!watched && pointReward != null && <span style={{ opacity: 0.85, fontWeight: 600, marginLeft: 2 }}>· +{pointReward}P</span>}
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={loading}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 'var(--radius-pill)', border: watched ? '1px solid var(--accent-yellow)' : '1px solid var(--border)', background: watched ? 'var(--accent-yellow-bg)' : 'var(--bg-surface)', color: watched ? 'var(--accent-yellow)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'var(--transition-fast)', whiteSpace: 'nowrap' }}>
      <span>{watched ? '★' : '☆'}</span>
      <span>{watched ? '등록됨' : `관심 ${label}`}</span>
      {!watched && pointReward != null && <span style={{ opacity: 0.7, fontWeight: 500 }}>+{pointReward}P</span>}
    </button>
  );
}

export const watchToast = {
  added: (pointReward?: number) => pointReward ? `★ 관심 등록 · +${pointReward}P 적립` : '★ 관심 등록',
  removed: () => '관심 해제됨',
};

/* ===== <ShareButton/> ===== */

interface ShareButtonProps {
  variant?: 'icon' | 'text' | 'kakao';
  onClick: () => void;
  loading?: boolean;
}

export function ShareButton({ variant = 'text', onClick, loading }: ShareButtonProps) {
  if (variant === 'icon') {
    return (
      <button type="button" onClick={onClick} disabled={loading} aria-label="공유"
        style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 15, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
        ⤴
      </button>
    );
  }
  if (variant === 'kakao') {
    return (
      <button type="button" onClick={onClick} disabled={loading}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: '#FEE500', color: '#191919', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
        💬 카톡 공유
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={loading}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
      <span style={{ fontSize: 14 }}>⤴</span><span>공유</span>
    </button>
  );
}

/* ===== <NotifyButton/> ===== */

interface NotifyButtonProps {
  state: 'guest' | 'eligible' | 'enabled';
  onClick: () => void;
  loading?: boolean;
  variant?: 'cta' | 'inline';
}

export function NotifyButton({ state, onClick, loading, variant = 'cta' }: NotifyButtonProps) {
  const compact = variant === 'inline';
  const padding = compact ? '8px 14px' : '12px 16px';
  const fontSize = compact ? 13 : 15;
  const baseStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: compact ? 'auto' : '100%', padding, borderRadius: 'var(--radius-md)', fontSize, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 } as const;

  if (state === 'guest') {
    return <button type="button" onClick={onClick} disabled={loading} style={{ ...baseStyle, border: 'none', background: '#FEE500', color: '#191919' }}>무료로 알림 받기</button>;
  }
  if (state === 'enabled') {
    return <button type="button" onClick={onClick} disabled={loading} style={{ ...baseStyle, border: '1px solid var(--accent-green)', background: 'var(--accent-green-bg)', color: 'var(--accent-green)' }}>🔔 알림 받는 중</button>;
  }
  return <button type="button" onClick={onClick} disabled={loading} style={{ ...baseStyle, border: 'none', background: 'var(--brand)', color: '#fff' }}>🔔 알림 받기</button>;
}

/* ===== <SeeAllLink/> ===== */

interface SeeAllLinkProps {
  href: string;
  variant?: 'card' | 'tab' | 'gate';
  label?: string;
  className?: string;
  onClick?: () => void;
}

export function SeeAllLink({ href, variant = 'card', label, className, onClick }: SeeAllLinkProps) {
  if (variant === 'gate') {
    return (
      <Link href={href} onClick={onClick} className={className}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
        {label || '로그인하고 계속'} →
      </Link>
    );
  }
  if (variant === 'tab') {
    return (
      <Link href={href} onClick={onClick} className={className}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
        {label || '전체'} →
      </Link>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={className}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--brand-border)', color: 'var(--brand)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
      {label || '더보기'} →
    </Link>
  );
}

/* ===== <FormActions/> ===== */

interface FormActionsProps {
  onPrev?: () => void;
  onNext?: () => void;
  onCancel?: () => void;
  nextLabel?: string;
  isLast?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

export function FormActions({ onPrev, onNext, onCancel, nextLabel, isLast, loading, disabled }: FormActionsProps) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
      {onCancel && <button type="button" onClick={onCancel} style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>취소</button>}
      {onPrev && <button type="button" onClick={onPrev} style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← 이전</button>}
      {onNext && <button type="button" onClick={onNext} disabled={loading || disabled} style={{ flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: isLast ? 'var(--accent-green)' : 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading || disabled ? 'not-allowed' : 'pointer', opacity: loading || disabled ? 0.6 : 1 }}>{loading ? '처리 중…' : nextLabel || (isLast ? '완료' : '다음 →')}</button>}
    </div>
  );
}

/* ===== SEARCH_PLACEHOLDER ===== */

export const SEARCH_PLACEHOLDER = {
  global: '🔍 종목 · 청약 · 단지 검색',
  apt: '🔍 단지 검색',
  aptArea: '🔍 단지명, 동 검색',
  stock: '🔍 종목 검색',
  stockCompare: '🔍 비교할 종목 추가',
  blog: '🔍 블로그 검색',
} as const;
