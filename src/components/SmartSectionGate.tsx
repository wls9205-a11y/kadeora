'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { trackCTA } from '@/lib/analytics';

interface Props {
  htmlContent: string;
  slug: string;
  category: string;
  userCount?: number;
  todaySignups?: number;
  aptName?: string;
  /** 봇/로그인 유저는 부모에서 분기하여 이 컴포넌트 자체를 렌더하지 않는 것이 권장.
   *  안전장치로 isBot=true 면 게이트 없이 전문 렌더. */
  isBot?: boolean;
  /** 무료 열람 허용 횟수 (기본 3). 같은 세션 내 4번째 글부터 게이트 작동.
   *  값을 0 으로 주면 무조건 게이트. */
  freeReads?: number;
}

const READS_KEY = 'kd_blog_reads';
const READS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

/* 카테고리별 혜택 메시지 — "텍스트 잠금해제" → "맞춤 알림 서비스" */
const CATEGORY_BENEFITS: Record<string, { headline: string; bullets: string[]; btnText: string }> = {
  apt: {
    headline: '이 아파트의 가격이 변하면',
    bullets: ['실거래가 변동 시 즉시 알림', '청약 마감 D-day 카운트다운', '관심 지역 주간 시세 리포트'],
    btnText: '알림 설정하기',
  },
  unsold: {
    headline: '이 지역 미분양이 해소되면',
    bullets: ['미분양 세대 변동 알림', '할인 분양 소식 즉시 전달', '관심 지역 시세 추적'],
    btnText: '알림 설정하기',
  },
  stock: {
    headline: '이 종목이 급등/급락하면',
    bullets: ['관심 종목 가격 변동 알림', '목표가 도달 시 즉시 알림', 'AI 투자 의견 주간 리포트'],
    btnText: '알림 설정하기',
  },
  finance: {
    headline: '내 돈에 영향 주는 변화가 생기면',
    bullets: ['세법·금리 변경 알림', '맞춤 절세 전략 리포트', '재테크 주간 브리핑'],
    btnText: '무료 알림 받기',
  },
  redev: {
    headline: '이 구역 단계가 변경되면',
    bullets: ['사업 단계 변경 즉시 알림', '구역 내 실거래가 추적', '관리처분·착공 일정 알림'],
    btnText: '알림 설정하기',
  },
};

const DEFAULT_BENEFIT = {
  headline: '관심 분야에 변화가 생기면',
  bullets: ['청약·시세 변동 즉시 알림', '주간 맞춤 시황 리포트', '관심 지역/종목 추적'],
  btnText: '무료 알림 받기',
};

export default function SmartSectionGate({
  htmlContent, slug, category, userCount = 90, todaySignups = 0, isBot = false, freeReads = 3
}: Props) {
  const pathname = usePathname();
  // null = 판정 전 (SSR), false = 게이트 없이 전문, true = 게이트 적용
  const [shouldGate, setShouldGate] = useState<boolean | null>(null);
  const [bypassedThisSession, setBypassedThisSession] = useState(false);

  // localStorage 기반 미터링: slug 별 첫 방문만 카운트, 30일 이상 된 항목 GC.
  useEffect(() => {
    if (isBot) { setShouldGate(false); return; }
    let reads: { slug: string; ts: number }[] = [];
    try {
      const raw = localStorage.getItem(READS_KEY);
      if (raw) reads = JSON.parse(raw);
      if (!Array.isArray(reads)) reads = [];
      const cutoff = Date.now() - READS_TTL_MS;
      reads = reads.filter(r => r && r.ts > cutoff);
    } catch { reads = []; }

    const seen = reads.some(r => r.slug === slug);
    if (!seen) {
      reads.push({ slug, ts: Date.now() });
      try { localStorage.setItem(READS_KEY, JSON.stringify(reads.slice(-200))); } catch {}
    }
    // 무료 카운트 = 현재 글을 포함한 고유 slug 수
    const uniqueCount = new Set(reads.map(r => r.slug)).size;
    setShouldGate(uniqueCount > freeReads);
  }, [slug, isBot, freeReads]);

  useEffect(() => {
    if (shouldGate === true && !bypassedThisSession) {
      trackCTA('view', 'content_gate', { page_path: pathname, category });
    }
  }, [shouldGate, bypassedThisSession, category, pathname]);

  // 같은 세션에서 "나중에" 클릭 시 — sessionStorage 표시
  useEffect(() => {
    try {
      if (sessionStorage.getItem(`kd_gate_bypass_${slug}`) === '1') setBypassedThisSession(true);
    } catch {}
  }, [slug]);

  // SSR 단계 + 판정 전: 빈 placeholder 만 렌더 (CLS 방지). 판정 후 적절한 분기로.
  if (shouldGate === null) {
    return <div className="blog-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  }
  if (shouldGate === false || bypassedThisSession) {
    return <div className="blog-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  }

  /* ── 클리프행어 컷포인트: 세 번째 H2 직전 ──
   * 콘텐츠의 대부분(40~70%)을 보여주어 신뢰 확보 후 CTA
   * "더 읽으려면 가입" 대신 "이 정보의 변화를 추적하려면 가입"
   */
  const { visibleSection, remainingHeadings } = useMemo(() => {
    const h2Matches = [...htmlContent.matchAll(/<h2[^>]*>/gi)];
    let cutPoint: number;

    if (h2Matches.length >= 3 && h2Matches[2].index !== undefined) {
      cutPoint = h2Matches[2].index;
      const minCut = Math.floor(htmlContent.length * 0.40);
      const maxCut = Math.floor(htmlContent.length * 0.70);
      cutPoint = Math.max(minCut, Math.min(cutPoint, maxCut));
    } else if (h2Matches.length >= 2 && h2Matches[1].index !== undefined) {
      cutPoint = h2Matches[1].index;
      const minCut = Math.floor(htmlContent.length * 0.40);
      const maxCut = Math.floor(htmlContent.length * 0.70);
      cutPoint = Math.max(minCut, Math.min(cutPoint, maxCut));
    } else {
      cutPoint = Math.floor(htmlContent.length * 0.60);
    }

    // H2/H3 경계에 맞춰 정확히 자르기
    const headingAfterCut = htmlContent.slice(cutPoint).match(/<h[23][^>]*>/i);
    const actualCut = headingAfterCut?.index ? cutPoint + headingAfterCut.index : cutPoint;
    const visible = htmlContent.slice(0, actualCut);

    // Preview Hook: 게이트 뒤 남은 H2/H3 제목 추출
    const remaining = htmlContent.slice(actualCut);
    const headings = [...remaining.matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim())
      .filter(h => h.length > 2 && h.length < 50)
      .slice(0, 3);

    return { visibleSection: visible, remainingHeadings: headings };
  }, [htmlContent]);

  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=content_gate`;
  const benefit = CATEGORY_BENEFITS[category] || DEFAULT_BENEFIT;
  const hasPreview = remainingHeadings.length > 0;

  const socialText = todaySignups > 0
    ? `오늘 ${todaySignups}명 가입 · 총 ${userCount.toLocaleString()}명 이용 중`
    : `${userCount.toLocaleString()}명이 무료로 이용 중`;

  const handleLater = () => {
    try { sessionStorage.setItem(`kd_gate_bypass_${slug}`, '1'); } catch {}
    setBypassedThisSession(true);
    trackCTA('dismiss', 'content_gate', { page_path: pathname, category });
  };

  return (
    <div className="blog-content" itemProp="articleBody">
      <div dangerouslySetInnerHTML={{ __html: visibleSection }} />

      {/* 페이드아웃 */}
      <div style={{
        height: 100, pointerEvents: 'none', marginTop: -40,
        background: 'linear-gradient(to bottom, rgba(5,10,24,0) 0%, rgba(5,10,24,1) 100%)',
      }} />

      {/* 게이트 카드 */}
      <div data-cta="content-gate" style={{ background: 'var(--bg-base, #050A18)', padding: '0 16px 32px' }}>
        <div style={{
          maxWidth: 400, width: '100%', margin: '0 auto',
          padding: '22px 20px', borderRadius: 16, boxSizing: 'border-box' as const,
          border: '1px solid rgba(254,229,0,0.2)',
          background: 'rgba(12,21,40,0.97)',
        }}>
          {hasPreview ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(224,232,240,0.4)', marginBottom: 10, textAlign: 'center', letterSpacing: '0.5px' }}>
                이 글에서 다루는 나머지 분석
              </div>
              <div style={{ marginBottom: 14 }}>
                {remainingHeadings.map((h, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 13, color: '#e2e8f0', fontWeight: 600, padding: '5px 0',
                  }}>
                    <span style={{ color: '#FEE500', fontSize: 12, flexShrink: 0 }}>✦</span>
                    {h}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.5, margin: '0 0 12px', textAlign: 'center' }}>
                {benefit.headline}<br />
                <span style={{ color: '#FEE500' }}>카더라가 알려드릴게요</span>
              </p>
              <div style={{ marginBottom: 16 }}>
                {benefit.bullets.map((b, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12, color: 'rgba(224,232,240,0.75)', padding: '4px 0',
                  }}>
                    <span style={{ color: '#22c55e', fontSize: 13 }}>✓</span>
                    {b}
                  </div>
                ))}
              </div>
            </>
          )}

          <a
            href={loginUrl}
            onClick={() => trackCTA('click', 'content_gate', { page_path: pathname, category })}
            style={{
              display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#FEE500', color: '#191919', borderRadius: 8,
              padding: '13px 0', fontSize: 15, fontWeight: 800, textDecoration: 'none',
              boxSizing: 'border-box' as const,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 512 512" fill="#191919">
              <path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z" />
            </svg>
            {hasPreview ? '카카오 3초 설정 → 알림 받기' : benefit.btnText}
          </a>

          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(224,232,240,0.3)', marginBottom: 4 }}>{socialText}</div>
            <button
              onClick={handleLater}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 11, color: 'rgba(224,232,240,0.35)',
                textDecoration: 'underline', textUnderlineOffset: '2px',
                padding: '2px 4px',
              }}
            >
              나중에 (이번 글은 그대로 보기)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
