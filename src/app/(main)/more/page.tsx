// r4-P4 — /more : 전체 메뉴 색인.
//
// 하단 탭 4개(홈·부동산·주식·블로그)와 서랍 8개에 들어가지 못한 페이지를 여기서 모은다.
// 서랍은 자주 쓰는 8개만 남기고, 나머지는 이 페이지가 받는다.
//
// 피드는 하단 탭에서 빠졌으므로 최상단에 둔다 — 커뮤니티로 가는 길을 잃지 않게.

import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL as SITE } from '@/lib/constants';
import HubHero from '@/components/detail/HubHero';

export const metadata: Metadata = {
  title: '전체 메뉴',
  description: '카더라의 모든 페이지 — 커뮤니티, 부동산·주식 도구, 블로그, 이용 안내를 한 곳에서 찾을 수 있습니다.',
  alternates: { canonical: `${SITE}/more` },
};

type Entry = { href: string; label: string; sub: string };
type Group = { title: string; eyebrow: string; items: Entry[] };

const GROUPS: Group[] = [
  {
    title: '커뮤니티',
    eyebrow: 'COMMUNITY — 사람들이 쓰는 글',
    items: [
      /* ⛔ '/feed' 항목 제거 — 잡담 피드 영구 폐쇄(Node 판정 2026-08-31).
         ⚠️ '/hot'·'/discuss' 는 «남긴다» — 폐쇄 대상은 잡담 목록이고 그 둘은 별 판정이다.
            같이 지우면 「접두가 닮았다」로 산 것을 죽이는 삭제 함정 ①이다. */
      { href: '/hot', label: '이번주 HOT', sub: '많이 읽힌 글 모아보기' },
      { href: '/discuss', label: '라운지 토론', sub: 'A vs B 투표·토론' },
      { href: '/search', label: '통합 검색', sub: '글·종목·단지 한번에' },
    ],
  },
  {
    title: '부동산',
    eyebrow: 'REAL ESTATE — 청약·실거래·정비사업',
    items: [
      { href: '/apt/complex', label: '단지백과', sub: '전국 단지 시세' },
      { href: '/apt/search', label: '실거래 검색', sub: '전국 실거래가' },
      { href: '/apt/redev', label: '재개발·재건축', sub: '정비사업 현황' },
      { href: '/apt/diagnose', label: '가점 진단', sub: '청약 가점 계산' },
      { href: '/apt/data', label: '부동산 통계', sub: '공공 데이터' },
    ],
  },
  {
    title: '주식',
    eyebrow: 'STOCK — 국내·해외 종목',
    items: [
      { href: '/stock/compare', label: '종목 비교', sub: '핵심 지표 비교' },
      { href: '/stock/search', label: '종목 검색', sub: '지표로 걸러보기' },
      { href: '/stock/dividend', label: '배당주 TOP', sub: '고배당 종목 순위' },
      { href: '/stock/movers', label: '급등락', sub: '등락률 상위' },
      { href: '/stock/themes', label: '테마주', sub: '섹터별 관련주' },
      { href: '/stock/data', label: '주식 통계', sub: '시장 데이터' },
    ],
  },
  {
    title: '읽을거리',
    eyebrow: 'READ — 분석과 리포트',
    items: [
      { href: '/blog/series', label: '시리즈', sub: '주제별 연재 모음' },
      { href: '/daily', label: '데일리 리포트', sub: '매일 시장 요약' },
      { href: '/glossary', label: '용어사전', sub: '투자 용어 풀이' },
      { href: '/press', label: '보도자료', sub: '언론 보도·소식' },
    ],
  },
  {
    title: '도구',
    eyebrow: 'TOOLS — 계산과 진단',
    items: [{ href: '/calc', label: '계산기', sub: '부동산·세금 계산' }],
  },
  {
    title: '내 계정',
    eyebrow: 'ACCOUNT — 설정과 알림',
    items: [
      { href: '/notifications/settings', label: '알림 설정', sub: '푸시·이메일·카카오' },
      { href: '/settings/region', label: '우리동네 설정', sub: '지역 설정·변경' },
      { href: '/settings/interests', label: '관심사 설정', sub: '맞춤 피드 설정' },
      { href: '/attendance', label: '출석 체크', sub: '매일 포인트 적립' },
      { href: '/premium', label: '프리미엄', sub: '유료 기능 안내' },
      { href: '/shop', label: '상점', sub: '포인트 사용처' },
    ],
  },
  {
    title: '안내',
    eyebrow: 'GUIDE — 이용 안내',
    items: [
      { href: '/guide', label: '가이드북', sub: '이용 방법 안내' },
      { href: '/guide#install', label: '앱 설치 가이드', sub: '홈화면에 추가하기' },
      { href: '/grades', label: '등급 안내', sub: '등급별 혜택' },
      { href: '/about', label: '서비스 소개', sub: '카더라 소개' },
      { href: '/faq', label: 'FAQ', sub: '자주 묻는 질문' },
      { href: '/consultant', label: '전문가 상담', sub: '상담 신청 안내' },
    ],
  },
];

export default function MorePage() {
  return (
    <main style={{ maxWidth: 'var(--container-read)', margin: '0 auto', padding: 'var(--sp-md)' }}>
      <HubHero
        eyebrow="MORE — 전체 메뉴"
        title="전체 메뉴"
        titleId="more-title"
        description="하단 탭에 없는 페이지를 모았습니다."
        stats={[{ label: '페이지', value: GROUPS.reduce((n, g) => n + g.items.length, 0) }]}
      />

      {GROUPS.map((g) => {
        const id = `more-${g.title}`;
        return (
          <section key={g.title} aria-labelledby={id} style={{ marginTop: 'var(--sp-xl)' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-xs)',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'var(--brand)',
                fontWeight: 600,
                marginBottom: 3,
              }}
            >
              {g.eyebrow}
            </div>
            <h2
              id={id}
              style={{
                fontSize: 'var(--fs-lg)',
                fontWeight: 600,
                letterSpacing: '-.02em',
                margin: '0 0 var(--sp-sm)',
                color: 'var(--text-primary)',
              }}
            >
              {g.title}
            </h2>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 'var(--sp-sm)',
              }}
            >
              {g.items.map((it) => (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    style={{
                      display: 'block',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface)',
                      padding: 'var(--sp-sm) var(--sp-md)',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {it.label}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        marginTop: 2,
                        fontSize: 'var(--fs-xs)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {it.sub}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
