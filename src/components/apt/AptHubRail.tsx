// v5-V2 — /apt 데스크탑 우측 레일.
//
// 전역 RightPanel 을 대체한다. 그쪽은 페이지 맥락과 무관했다 —
// 부동산 화면인데 인기 검색어가 '삼성전자·AI반도체·엔비디아' 였고,
// 라운지 블록은 '아직 대화가 없어요' 로 화면 4분의 1을 먹었다
// (/discuss 30일 방문 데스크탑 2 · 모바일 2).
// 카카오 가입 CTA 가 우측 최상단이었던 것도 여기서 없앤다 —
// 사이트 1순위 전환은 리드폼이고 가입은 부가다.
//
// /apt/[id] 의 SiteDetailRail 과 같은 패턴이다. 레일은 페이지가 소유한다.

import Link from 'next/link';
import { aptHref, type AptHubItem } from '@/lib/apt/hub';
import { formatComplexName } from '@/lib/apt/subscription-status';
import { rowStatusChip } from '@/lib/apt/subscription-badge';

export default function AptHubRail({
  region,
  imminent,
  regions,
  blogs,
}: {
  region: string;
  /** 마감 임박 — 페이지가 이미 받은 카드에서 골라 넘긴다 (조회 추가 없음). */
  imminent: AptHubItem[];
  regions: { region: string; live: number }[];
  blogs: { slug: string; title: string }[];
}) {
  return (
    <>
      {imminent.length > 0 && (
        <div className="kd-rail-panel">
          <h2>마감 임박</h2>
          {imminent.map((it) => {
            const chip = rowStatusChip(it.status, it.dday);
            return (
              <Link key={it.id} href={aptHref(it)}>
                <span className={chip.tone ? `kd-lrow-badge ${chip.tone}` : 'kd-lrow-badge'}>{chip.label}</span>
                {formatComplexName(it.region_nm, it.house_nm)}
              </Link>
            );
          })}
        </div>
      )}

      <div className="kd-rail-panel">
        <h2>지역 바로가기</h2>
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
          {regions.map((r) => (
            <Link
              key={r.region}
              href={`/apt?region=${encodeURIComponent(r.region)}`}
              scroll={false}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--sp-xs)',
                minHeight: 32,
                padding: '0 10px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border)',
                background: r.region === region ? 'var(--brand)' : 'var(--bg-sunken)',
                color: r.region === region ? 'var(--text-inverse)' : 'var(--text-secondary)',
                fontSize: 'var(--fs-xs)',
                fontWeight: r.region === region ? 600 : 500,
                textDecoration: 'none',
              }}
            >
              {r.region}
              {r.live > 0 && (
                <span style={{ fontSize: 'var(--fs-xs)', opacity: r.region === region ? 0.85 : 0.65 }}>{r.live}</span>
              )}
            </Link>
          ))}
        </div>
        <Link href="/apt/region" style={{ borderBottom: 0, marginTop: 8, color: 'var(--text-secondary)' }}>
          전체 17개 시·도 →
        </Link>
      </div>

      {blogs.length > 0 && (
        <div className="kd-rail-panel">
          <h2>관련 분석</h2>
          {blogs.slice(0, 6).map((b) => (
            <Link key={b.slug} href={`/blog/${b.slug}`}>{b.title}</Link>
          ))}
        </div>
      )}

      <div className="kd-rail-panel">
        <h2>바로가기</h2>
        <Link href="/apt/diagnose">청약 가점 계산기</Link>
        <Link href="/apt/ranking">청약 경쟁률 랭킹</Link>
        <Link href="/apt/unsold">미분양 현황</Link>
        {/* ⛔ H6-2 — 「분양 지도」 바로가기 제거. H5-2 에서 [목록|지도] 토글을 내렸는데
            레일 링크가 남아 「지도가 이 사이트의 기능」이라고 계속 말하고 있었다.
            /apt/map 라우트는 그대로다(200 + noindex) — 링크만 뺀다. */}
        <Link href="/apt/complex">단지 백과</Link>
      </div>
    </>
  );
}
