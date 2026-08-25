// s273 — /apt/compare 랜딩.
//
// 기존에는 /apt/compare/[slugs] 만 있어서 /apt (도구 칩) 가 가리키던 /apt/compare 가
// 그대로 404 였다. 청약 퍼스트 재설계에서 '단지 비교' 칩이 정식 도구로 승격되면서
// 진입점이 필요해져 최소 랜딩만 추가한다.
//
// [slugs] 라우트는 apt_complex_profiles.apt_name 정확 일치 2개('A-vs-B')를 요구하고
// 하나라도 없으면 notFound() 로 떨어진다. 그래서 여기서 내려주는 쌍은 전부
// DB 에 실재하는 단지명으로만 구성한다 — 링크가 404 로 가지 않도록.

import type { Metadata } from 'next';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const revalidate = 3600;
export const maxDuration = 15;

export const metadata: Metadata = {
  title: '아파트 단지 비교 — 실거래가·전세가율·연차 한눈에',
  description:
    '두 아파트 단지의 매매가·전세가·전세가율·연차·거래량을 나란히 비교. 같은 지역 인기 단지 조합을 바로 확인하세요.',
  alternates: { canonical: `${SITE_URL}/apt/compare` },
  openGraph: {
    title: '아파트 단지 비교 — 카더라',
    description: '두 단지의 실거래가·전세가율·거래량을 나란히 비교합니다.',
    url: `${SITE_URL}/apt/compare`,
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
  },
};

type Row = { apt_name: string; region_nm: string | null; sigungu: string | null; latest_sale_price: number | null };

function pairHref(a: string, b: string): string {
  return `/apt/compare/${encodeURIComponent(`${a}-vs-${b}`)}`;
}

/** 같은 시군구 안에서 거래가 활발한 단지끼리 짝지어 준다. 전부 실재하는 이름이라 404 가 없다. */
async function fetchPairs(): Promise<{ region: string; a: Row; b: Row }[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any)
      .from('apt_complex_profiles')
      .select('apt_name, region_nm, sigungu, latest_sale_price, sale_count_1y')
      .not('latest_sale_price', 'is', null)
      .not('sigungu', 'is', null)
      .order('sale_count_1y', { ascending: false })
      .limit(400);

    if (error) {
      console.error('[apt/compare] fetch error:', error.message);
      return [];
    }

    const byArea = new Map<string, Row[]>();
    for (const r of (data ?? []) as Row[]) {
      const key = `${r.region_nm ?? ''} ${r.sigungu ?? ''}`.trim();
      if (!key) continue;
      const list = byArea.get(key) ?? [];
      if (list.length < 2) list.push(r);
      byArea.set(key, list);
    }

    return [...byArea.entries()]
      .filter(([, list]) => list.length === 2)
      .slice(0, 24)
      .map(([region, list]) => ({ region, a: list[0], b: list[1] }));
  } catch (e: any) {
    console.error('[apt/compare] caught:', e?.message ?? String(e));
    return [];
  }
}

export default async function AptComparePage() {
  const pairs = await fetchPairs();

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px 6px 28px' }}>
      <h1 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 6px' }}>아파트 단지 비교</h1>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.6 }}>
        두 단지의 매매가·전세가율·연차·거래량을 나란히 놓고 봅니다. 아래 인기 조합을 바로 열거나,
        검색에서 단지를 찾아 비교하세요.
      </p>

      <Link
        href="/apt/search"
        style={{
          display: 'inline-block',
          padding: '9px 14px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          fontSize: 12.5,
          fontWeight: 700,
          textDecoration: 'none',
          marginBottom: 20,
        }}
      >
        🔍 단지 검색해서 비교하기
      </Link>

      {pairs.length > 0 ? (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>지역별 인기 조합</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {pairs.map(({ region, a, b }) => (
              <Link
                key={`${a.apt_name}-${b.apt_name}`}
                href={pairHref(a.apt_name, b.apt_name)}
                style={{
                  display: 'block',
                  padding: '11px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                }}
              >
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginBottom: 3 }}>{region}</div>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4, wordBreak: 'keep-all' }}>
                  {a.apt_name} <span style={{ color: 'var(--text-tertiary)' }}>vs</span> {b.apt_name}
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div
          style={{
            padding: '24px 16px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            textAlign: 'center',
            fontSize: 12.5,
            color: 'var(--text-secondary)',
          }}
        >
          비교 조합을 불러오지 못했습니다. 검색에서 단지를 직접 찾아 비교해 주세요.
        </div>
      )}
    </div>
  );
}
