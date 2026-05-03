'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { trackCTA } from '@/lib/analytics';
import { getVariant, trackAbView, trackAbClick } from '@/lib/analytics/abTest';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const EXPERIMENT = 'content_gate_v223';

interface Props {
  htmlContent: string;
  slug: string;
  category: string;
  userCount?: number;
  todaySignups?: number;
  aptName?: string;
  /** s222 F: B variant 시 apt_region_recent_change(region, 7) 호출용. 미제공 시 전국. */
  region?: string;
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
    btnText: '무료로 알림 받기',
  },
  unsold: {
    headline: '이 지역 미분양이 해소되면',
    bullets: ['미분양 세대 변동 알림', '할인 분양 소식 즉시 전달', '관심 지역 시세 추적'],
    btnText: '무료로 알림 받기',
  },
  stock: {
    headline: '이 종목이 급등/급락하면',
    bullets: ['관심 종목 가격 변동 알림', '목표가 도달 시 즉시 알림', 'AI 투자 의견 주간 리포트'],
    btnText: '무료로 알림 받기',
  },
  finance: {
    headline: '내 돈에 영향 주는 변화가 생기면',
    bullets: ['세법·금리 변경 알림', '맞춤 절세 전략 리포트', '재테크 주간 브리핑'],
    btnText: '무료로 알림 받기',
  },
  redev: {
    headline: '이 구역 단계가 변경되면',
    bullets: ['사업 단계 변경 즉시 알림', '구역 내 실거래가 추적', '관리처분·착공 일정 알림'],
    btnText: '무료로 알림 받기',
  },
};

const DEFAULT_BENEFIT = {
  headline: '관심 분야에 변화가 생기면',
  bullets: ['청약·시세 변동 즉시 알림', '주간 맞춤 시황 리포트', '관심 지역/종목 추적'],
  btnText: '무료로 알림 받기',
};

export default function SmartSectionGate({
  htmlContent, slug, category, userCount = 90, todaySignups = 0, isBot = false, freeReads = 3, region
}: Props) {
  const pathname = usePathname();
  // null = 판정 전 (SSR), false = 게이트 없이 전문, true = 게이트 적용
  const [shouldGate, setShouldGate] = useState<boolean | null>(null);
  const [bypassedThisSession, setBypassedThisSession] = useState(false);
  // s222 F: A/B variant + 데이터 fetch
  const [variant, setVariant] = useState<'A' | 'B' | null>(null);
  const [regionData, setRegionData] = useState<{
    region: string; change_pct: number | null; avg_won_diff: number | null;
  } | null>(null);
  useEffect(() => {
    setVariant(getVariant(EXPERIMENT, ['A', 'B']) as 'A' | 'B');
  }, []);

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
    if (shouldGate === true && !bypassedThisSession && variant !== null) {
      trackCTA('view', 'content_gate', { page_path: pathname, category });
      trackAbView(EXPERIMENT, variant, { category, region: region ?? null });
    }
  }, [shouldGate, bypassedThisSession, category, pathname, variant, region]);

  // s222 F: B variant 시 지역 매매가 변동 데이터 fetch (1회)
  useEffect(() => {
    if (variant !== 'B' || shouldGate !== true) return;
    let cancelled = false;
    (async () => {
      try {
        const sb = createSupabaseBrowser();
        const { data } = await (sb as any).rpc('apt_region_recent_change', {
          p_region: region ?? null, p_window_days: 7,
        });
        if (cancelled || !data) return;
        const d = data as { region: string; change_pct: number | string | null; avg_won_diff: number | string | null };
        setRegionData({
          region: d.region,
          change_pct: d.change_pct === null || d.change_pct === undefined ? null : Number(d.change_pct),
          avg_won_diff: d.avg_won_diff === null || d.avg_won_diff === undefined ? null : Number(d.avg_won_diff),
        });
      } catch { /* fallback to enhanced V1 */ }
    })();
    return () => { cancelled = true; };
  }, [variant, shouldGate, region]);

  // 같은 세션에서 "나중에" 클릭 시 — sessionStorage 표시
  useEffect(() => {
    try {
      if (sessionStorage.getItem(`kd_gate_bypass_${slug}`) === '1') setBypassedThisSession(true);
    } catch {}
  }, [slug]);

  /* ── 클리프행어 컷포인트: 세 번째 H2 직전 ──
   * 콘텐츠의 대부분(40~70%)을 보여주어 신뢰 확보 후 CTA
   * "더 읽으려면 가입" 대신 "이 정보의 변화를 추적하려면 가입"
   *
   * s204: hook 은 early return 전에 호출되어야 함 — useMemo 가 early return 뒤에
   * 있으면 shouldGate 상태에 따라 hook count 가 6 ↔ 7 변동하여 React #310 발생.
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

  // SSR 단계 + 판정 전: 빈 placeholder 만 렌더 (CLS 방지). 판정 후 적절한 분기로.
  if (shouldGate === null) {
    return <div className="blog-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  }
  if (shouldGate === false || bypassedThisSession) {
    return <div className="blog-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  }

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

  // s222 F: B variant 카피 (데이터 있으면 손실 회피, 없으면 enhanced V1 fallback).
  // 데이터 임계: |change_pct| ≥ 0.5% — 너무 작은 변화는 fallback.
  const useBLossCopy = variant === 'B' && regionData
    && regionData.change_pct !== null
    && Math.abs(regionData.change_pct) >= 0.5;
  const useBFallback = variant === 'B' && !useBLossCopy;
  const bWonDiffEok = regionData?.avg_won_diff != null
    ? Math.abs(Math.round(regionData.avg_won_diff / 100) / 100)  // 만원 → 억원 (소수 2자리)
    : null;

  return (
    <div className="blog-content" itemProp="articleBody">
      <div dangerouslySetInnerHTML={{ __html: visibleSection }} />

      {/* 페이드아웃 — s215: 모드별 토큰 */}
      <div style={{
        height: 100, pointerEvents: 'none', marginTop: -40,
        background: 'linear-gradient(to bottom, var(--gate-fade-from) 0%, var(--gate-fade-to) 100%)',
      }} />

      {/* 게이트 카드 — s215: 토큰화 */}
      <div data-cta="content-gate" style={{ background: 'var(--bg-base)', padding: '0 16px 32px' }}>
        <div style={{
          maxWidth: 400, width: '100%', margin: '0 auto',
          padding: '22px 20px', borderRadius: 16, boxSizing: 'border-box' as const,
          border: '1px solid var(--gate-card-border)',
          background: 'var(--gate-card-bg)',
          boxShadow: 'var(--shadow-md)',
        }}>
          {hasPreview ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gate-card-faint)', marginBottom: 10, textAlign: 'center', letterSpacing: '0.5px' }}>
                이 글에서 다루는 나머지 분석
              </div>
              <div style={{ marginBottom: 14 }}>
                {remainingHeadings.map((h, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 13, color: 'var(--gate-card-text)', fontWeight: 600, padding: '5px 0',
                  }}>
                    <span style={{ color: 'var(--gate-accent)', fontSize: 12, flexShrink: 0 }}>✦</span>
                    {h}
                  </div>
                ))}
              </div>
            </>
          ) : useBLossCopy && regionData ? (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gate-card-text)', lineHeight: 1.5, margin: '0 0 12px', textAlign: 'center' }}>
                지난 주 {regionData.region} 평균 매매가 <span style={{ color: 'var(--gate-accent)' }}>{Number(regionData.change_pct).toFixed(1)}%</span> 변동<br />
                <span style={{ color: 'var(--gate-card-muted)', fontWeight: 600, fontSize: 13 }}>
                  {bWonDiffEok !== null ? `평균 ${bWonDiffEok}억원 차이` : '실거래가 큰 폭 변동 중'}
                </span>
              </p>
              <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--gate-card-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                알림 없으면 다음 변동도 모르고 지나가요
              </div>
            </>
          ) : useBFallback ? (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gate-card-text)', lineHeight: 1.5, margin: '0 0 12px', textAlign: 'center' }}>
                이 정보, 변하면 알아야 하지 않을까요?<br />
                <span style={{ color: 'var(--gate-accent)' }}>놓치면 다음에 다시 못 만나요</span>
              </p>
              <div style={{ marginBottom: 16 }}>
                {benefit.bullets.map((b, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12, color: 'var(--gate-card-muted)', padding: '4px 0',
                  }}>
                    <span style={{ color: 'var(--accent-green)', fontSize: 13 }}>✓</span>
                    {b}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gate-card-text)', lineHeight: 1.5, margin: '0 0 12px', textAlign: 'center' }}>
                {benefit.headline}<br />
                <span style={{ color: 'var(--gate-accent)' }}>카더라가 알려드릴게요</span>
              </p>
              <div style={{ marginBottom: 16 }}>
                {benefit.bullets.map((b, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12, color: 'var(--gate-card-muted)', padding: '4px 0',
                  }}>
                    <span style={{ color: 'var(--accent-green)', fontSize: 13 }}>✓</span>
                    {b}
                  </div>
                ))}
              </div>
            </>
          )}

          <a
            href={loginUrl}
            onClick={() => {
              trackCTA('click', 'content_gate', { page_path: pathname, category });
              if (variant) trackAbClick(EXPERIMENT, variant, { category, region: region ?? null });
            }}
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
            {hasPreview ? '무료로 알림 받기' : benefit.btnText}
          </a>

          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--gate-card-faint)', marginBottom: 4 }}>{socialText}</div>
            <button
              onClick={handleLater}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 11, color: 'var(--gate-card-faint)',
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
