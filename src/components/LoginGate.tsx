'use client';
/**
 * LoginGate v2 — 기능 게이팅 + 카카오 네이티브 가입 CTA
 *
 * SEO 안전: SSR(!mounted) → children 전체 렌더 (봇이 읽음)
 * 클라이언트: 로그인 → children 전체, 비로그인 → 블러 + 카카오 CTA
 *
 * v2 (세션 108): 콘텐츠 게이팅 → 기능 게이팅 전면 개편
 * - "회원 전용" 뱃지 + 블러 미리보기 + "가입하면 바로 확인할 수 있어요"
 * - 카카오 48px 네이티브 버튼 (아이콘 좌측 고정, 텍스트 중앙)
 * - "다른 방법으로 가입하기" 보조 링크
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useEffect, useRef, useState, ReactNode } from 'react';
import { trackCTA } from '@/lib/analytics';

interface LoginGateProps {
  children: ReactNode;
  feature: string;
  title?: string;
  description?: string;
  blurHeight?: number;
  overlayText?: string;
}

const DEFAULTS: Record<string, { title: string; desc: string }> = {
  ai_analysis: { title: 'AI 투자 분석 보기', desc: '이 종목의 적정가·리스크·전망을 AI가 분석했어요' },
  apt_analysis: { title: '단지 종합 분석 보기', desc: '이 단지의 실거래가 추이와 투자 분석을 확인하세요' },
  comparison: { title: '맞춤 비교 분석', desc: '관심 종목/단지와 비슷한 항목을 한눈에 비교' },
  price_alert: { title: '가격 변동 알림 설정', desc: '급등/급락, 청약 마감 소식을 놓치지 마세요' },
  blog_compare: { title: '주변 단지 시세 비교', desc: '이 단지와 주변 단지 실거래가를 한눈에' },
  blog_calc: { title: '내 가점 당첨 확률 계산', desc: '무주택 기간, 부양가족, 통장 기간으로 예측' },
  blog_stock_ai: { title: 'AI 종목 분석 리포트', desc: '기술적 분석 + 수급 + 실적 전망 종합' },
  blog_finance: { title: '절세 시뮬레이션', desc: '세금·금리·연금을 조건별로 비교' },
  apt_trade_alert: { title: '실거래 변동 알림', desc: '이 단지에 새 거래가 등록되면 바로 알려드려요' },
  apt_sub_alert: { title: '청약 마감 알림', desc: '관심 단지 접수일 전에 미리 알려드려요' },
  apt_ongoing_alert: { title: '분양 조건 변동 알림', desc: '분양가 변경, 할인 소식을 바로 받아요' },
  apt_unsold_alert: { title: '미분양 할인 알림', desc: '관심 지역 미분양 할인·재분양 시 알림' },
  redev_stage: { title: '사업 단계 변경 알림', desc: '관심 구역 단계가 바뀌면 즉시 알려드려요' },
  apt_complex_track: { title: '관심 단지 시세 추적', desc: '여러 단지를 비교하고 시세 변동을 추적' },
  apt_compare_save: { title: '비교 결과 저장', desc: '전세가율, 평당가, 학군까지 비교 후 저장' },
  apt_search_track: { title: '관심 단지 시세 추적', desc: '검색한 단지의 새 거래를 자동 추적' },
  apt_map_alert: { title: '관심 지역 알림', desc: '내 지역에 새 분양·청약·재개발 소식 알림' },
  calc_save: { title: '계산 결과 저장 + 비교', desc: '여러 조건으로 시뮬레이션 후 비교' },
  feed_write: { title: '글쓰기 · 댓글 · 투표', desc: '가입하면 커뮤니티에 참여할 수 있어요' },
};

export default function LoginGate({ children, feature, title, description, blurHeight = 200, overlayText }: LoginGateProps) {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const tracked = useRef(false);
  const [mounted, setMounted] = useState(false);
  const d = DEFAULTS[feature] || DEFAULTS.ai_analysis;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!tracked.current && mounted && !userId && !loading) {
      tracked.current = true;
      trackCTA('view', `login_gate_${feature}`, { page_path: pathname });
    }
  }, [userId, loading, feature, pathname, mounted]);

  // SSR 또는 로딩 중 또는 로그인 → children 전체 표시
  // 세션 150: mount 전에는 고정 높이 래퍼로 CLS 방지
  if (!mounted) {
    return <div aria-hidden="true" style={{ minHeight: Math.max(blurHeight, 200), margin: '18px 0' }} />;
  }
  if (loading || userId) {
    return <>{children}</>;
  }

  // 비로그인 → 블러 + 카카오 CTA
  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=login_gate_${feature}`;
  const altUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=login_gate_${feature}_alt`;

  return (
    <div style={{ borderRadius: 14, padding: '18px 16px', margin: '18px 0', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ display: 'inline-block', fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.28)', marginBottom: 8 }}>
        회원 전용
      </span>
      <div style={{ fontSize: 14, fontWeight: 500, color: '#ccc7bf', marginBottom: 3 }}>
        {title || d.title}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>
        {description || d.desc}
      </div>

      {/* 블러 미리보기 + 오버레이 */}
      <div style={{ borderRadius: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', position: 'relative', overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none', maxHeight: blurHeight, overflow: 'hidden' }}>
          {children}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,17,32,0.6)', borderRadius: 10 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            {overlayText || '가입하면 바로 확인할 수 있어요'}
          </span>
        </div>
      </div>

      {/* 카카오 네이티브 버튼 (48px, 아이콘 좌측 고정, 텍스트 중앙) */}
      <Link
        href={loginUrl}
        onClick={() => trackCTA('click', `login_gate_${feature}`, { page_path: pathname })}
        style={{
          display: 'flex', width: '100%', height: 48, borderRadius: 12,
          background: '#FEE500', alignItems: 'center', justifyContent: 'center',
          position: 'relative', textDecoration: 'none', boxSizing: 'border-box',
        }}
      >
        <svg style={{ position: 'absolute', left: 16 }} width="18" height="18" viewBox="0 0 512 512" fill="rgba(0,0,0,0.9)">
          <path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z" />
        </svg>
        <span style={{ fontSize: 15, color: 'rgba(0,0,0,0.85)', fontWeight: 500, letterSpacing: '-0.2px' }}>
          카카오로 가입
        </span>
      </Link>

      {/* 다른 방법으로 가입하기 */}
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.16)', textAlign: 'center', marginTop: 10 }}>
        <Link
          href={altUrl}
          onClick={() => trackCTA('click', `login_gate_${feature}_alt`, { page_path: pathname })}
          style={{ color: 'rgba(255,255,255,0.16)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
        >
          다른 방법으로 가입하기
        </Link>
      </div>
    </div>
  );
}
