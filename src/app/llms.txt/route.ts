import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { CALC_REGISTRY } from '@/lib/calc/registry';

export const revalidate = 86400; // 24시간 캐시

/**
 * GET /llms.txt — AI 모델용 사이트 요약 (llmstxt.org 스펙 준수)
 *
 * robots.txt = 검색 엔진에게 "어디를 크롤링하지 마"
 * sitemap.xml = 검색 엔진에게 "모든 페이지 목록"
 * llms.txt = AI 모델에게 "이 사이트는 이런 곳이고, 핵심 콘텐츠는 여기야"
 */
// s8: 하드코딩 수치가 실제와 크게 어긋나 있었다 (블로그 59,400+ → 실제 8,775).
// llms.txt · /about · 실제 DB 가 서로 다른 숫자를 말하던 상태라 DB 에서 직접 센다.
// 라우트가 이미 revalidate 86400 이라 매 요청 부담은 없다.
const FALLBACK = {
  blog: 8775, stocks: 1846, subs: 2851, sites: 5924,
  complex: 34544, trades: 726054, posts: 12909,
  priced: 26835, sigunguHubs: 191, dongHubs: 1440,
};

async function counts() {
  try {
    const sb = getSupabaseAdmin();
    const one = async (t: string, f?: (q: any) => any) => {
      let q = (sb as any).from(t).select('*', { count: 'exact', head: true });
      if (f) q = f(q);
      const { count } = await q;
      return typeof count === 'number' ? count : null;
    };
    const [blog, stocks, subs, sites, complex, trades, posts, priced] = await Promise.all([
      one('blog_posts', (q: any) => q.eq('is_published', true)),
      one('stock_quotes'), one('apt_subscriptions'), one('apt_sites'),
      one('apt_complex_profiles'), one('apt_transactions'), one('posts'),
      one('apt_complex_profiles', (q: any) => q.not('latest_sale_price', 'is', null)),
    ]);
    // 지역 허브 수 — sitemap/[id] 와 같은 기준(시군구 ≥10 · 동 ≥5, age_group IS NOT NULL).
    //
    // ⚠️ 여기 있던 34k행 페이지네이션(range(off) 34~100 왕복)이 Next 의 정적 생성
    //    타임아웃 60초를 넘겨 2026-08-23 배포를 통째로 죽였다. 급한 불은 20초 예산으로
    //    껐지만 그 방식은 **데이터가 커질수록 항상 예산을 넘겨 영원히 FALLBACK 상수만
    //    내보내게 된다** — 원인(왕복 수)이 그대로였기 때문이다.
    //    DB 담당이 같은 임계값·같은 필터로 집계 RPC 를 만들어 한 번 호출로 끝낸다 (실측 500ms).
    //
    // ⚠️ 같은 range(off) 패턴이 src/app/sitemap/[id]/route.ts 에도 8곳 있지만 그 파일은
    //    force-dynamic 이라 빌드타임 프리렌더 대상이 아니다. 손대지 않는다.
    let sigunguHubs = FALLBACK.sigunguHubs;
    let dongHubs = FALLBACK.dongHubs;
    try {
      const { data: hub, error } = await (sb as any).rpc('get_llms_hub_counts');
      if (error) throw new Error(error.message);
      // RPC 가 값을 못 주면 0 으로 덮지 않는다 — 0 은 "허브가 없다" 는 거짓말이 된다.
      const sg = Number(hub?.sigungu_hubs);
      const dg = Number(hub?.dong_hubs);
      if (Number.isFinite(sg) && sg > 0) sigunguHubs = sg;
      if (Number.isFinite(dg) && dg > 0) dongHubs = dg;
    } catch (e: any) {
      // 집계 실패 시 폴백 유지 — llms.txt 자체는 계속 나가야 한다.
      // 조용히 폴백하면 숫자가 낡은 걸 아무도 모른다.
      console.warn('[llms.txt] get_llms_hub_counts 실패, FALLBACK 사용:', e?.message ?? String(e));
    }
    return {
      blog: blog ?? FALLBACK.blog, stocks: stocks ?? FALLBACK.stocks,
      subs: subs ?? FALLBACK.subs, sites: sites ?? FALLBACK.sites,
      complex: complex ?? FALLBACK.complex, trades: trades ?? FALLBACK.trades,
      posts: posts ?? FALLBACK.posts, priced: priced ?? FALLBACK.priced,
      sigunguHubs, dongHubs,
    };
  } catch {
    // DB 장애로 llms.txt 자체가 죽지 않게 한다 (리스크 #4)
    return FALLBACK;
  }
}

export async function GET() {
  const c = await counts();
  const n = (v: number) => v.toLocaleString('ko-KR');
  // 계산기 수는 레지스트리에서 직접 센다 — 142 와 145 가 코드 곳곳에 섞여 있었다.
  const calcCount = CALC_REGISTRY.length;
  const calcCatCount = new Set(CALC_REGISTRY.map((c) => c.category)).size;
  // 카테고리 목록도 레지스트리에서 만든다 — 하드코딩본은 연말정산이 두 번 나오고
  // 주식/투자·쇼핑/소비가 빠져 있었으며, CATEGORIES.count 합(150)도 실제와 어긋났다.
  const calcCategories = (() => {
    const byCat = new Map<string, { label: string; n: number; ex: string[] }>();
    for (const c of CALC_REGISTRY) {
      const cur = byCat.get(c.category) || { label: c.categoryLabel, n: 0, ex: [] };
      cur.n += 1;
      if (cur.ex.length < 3) cur.ex.push(c.titleShort || c.title);
      byCat.set(c.category, cur);
    }
    return [...byCat.values()]
      .sort((a, b) => b.n - a.n)
      .map((v) => `- ${v.label} (${v.n}종): ${v.ex.join(", ")} 등`)
      .join('\n');
  })();
  const content = `# 카더라 (kadeora.app)

> 카더라는 대한민국 부동산·주식·재테크 정보 커뮤니티입니다. 아파트 청약, 주식 시세, AI 블로그, 무료 계산기, 실시간 토론 기능을 제공합니다. 모든 서비스는 한국어로 제공되며, 대한민국 사용자를 대상으로 합니다.

## 사이트 개요

- 공식 URL: ${SITE_URL}
- 운영자: 카더라
- 이메일: kadeora.app@gmail.com
- 언어: 한국어 (ko-KR)
- 기술 스택: Next.js 15, Supabase, Vercel

## 핵심 데이터 규모

- 블로그: ${n(c.blog)}편 (발행 기준, AI 생성 + DB 데이터 기반, 매일 증가)
- 주식 종목: ${n(c.stocks)}개 (KOSPI, KOSDAQ, NYSE, NASDAQ)
- 아파트 청약: ${n(c.subs)}건 (공공데이터포털 API 실시간 동기화)
- 분양사이트: ${n(c.sites)}개 (전국 아파트 분양 정보)
- 단지백과: ${n(c.complex)}개 (아파트 상세 정보, 실거래가·전세가율·거래량)
- 실거래 데이터: ${n(c.trades)}건 (국토교통부 실거래가 공개시스템)
- 시군구 허브: ${n(c.sigunguHubs)}개 (시군구별 아파트 시세 분석)
- 동 허브: ${n(c.dongHubs)}개 (동별 아파트 시세 분석)
- 무료 계산기: ${calcCount}종 (세금, 부동산, 투자, 급여, 대출 등 ${calcCatCount}개 카테고리)
- 커뮤니티 게시글: ${n(c.posts)}편

## 주요 섹션

### 주식 시세 (/stock)
KOSPI, KOSDAQ, NYSE, NASDAQ ${n(c.stocks)}개 종목의 시세를 제공합니다. 금융위원회 공공데이터 API(국내)와 Yahoo Finance(해외)를 데이터 소스로 사용합니다.

- [실시간 주식 시세](${SITE_URL}/stock): 종목 목록, 섹터 히트맵, AI 브리핑
- [종목 상세](${SITE_URL}/stock/005930): 개별 종목 시세, 차트, AI 분석, 수급 동향 (예: 삼성전자)
- [종목 비교](${SITE_URL}/stock/compare): 두 종목 대비 분석
- [섹터 분석](${SITE_URL}/stock/sector/반도체): 업종별 종목 분석

### 부동산 (/apt)
아파트 청약, 분양, 미분양, 재개발, 실거래 정보를 제공합니다. 국토교통부, 공공데이터포털, 한국부동산원 등의 공공 API를 데이터 소스로 사용합니다.

- [청약 정보](${SITE_URL}/apt): 전국 아파트 청약 일정, 경쟁률, 당첨 가점
- [분양사이트](${SITE_URL}/apt): ${n(c.sites)}개 아파트 분양 상세 정보
- [단지백과](${SITE_URL}/apt/complex): ${n(c.complex)}개 아파트 단지 상세 (시세, 전세가율, 거래량)
- [시군구별 시세](${SITE_URL}/apt/area/서울/강남구): ${n(c.sigunguHubs)}개 시군구별 아파트 시세 비교
- [동별 시세](${SITE_URL}/apt/area/서울/강남구/반포동): ${n(c.dongHubs)}개 동별 아파트 시세
- [청약 진단](${SITE_URL}/apt/diagnose): 청약 가점 계산 + 당첨 확률 분석
- [지역별 분석](${SITE_URL}/apt/region/서울): 시도별 부동산 시장 현황
- [실거래가 검색](${SITE_URL}/apt/search): 전국 아파트 실거래가 검색

#### 부동산 URL 패턴
- 단지별 상세: ${SITE_URL}/apt/{단지슬러그} (${n(c.sites)}개)
- 단지백과: ${SITE_URL}/apt/complex/{단지명} (${n(c.complex)}개)
- 시군구 허브: ${SITE_URL}/apt/area/{광역시도}/{시군구} (${n(c.sigunguHubs)}개)
- 동 허브: ${SITE_URL}/apt/area/{광역시도}/{시군구}/{동} (${n(c.dongHubs)}개)

#### 부동산 핵심 데이터 (공공데이터 기반)
- 전국 아파트 단지: ${n(c.complex)}개 (실거래가 보유 ${n(c.priced)}개)
- 전국 실거래 데이터: ${n(c.trades)}건
- 데이터 출처: 국토교통부 실거래가 공개시스템, 한국부동산원, 청약홈

### 블로그 (/blog)
AI 기반으로 생성된 ${n(c.blog)}편(발행 기준)의 부동산·주식·재테크 분석 블로그입니다. DB의 실제 데이터(시세, 청약 정보, 거래 내역)를 기반으로 작성됩니다.

- [블로그 목록](${SITE_URL}/blog): 카테고리별 블로그 (부동산, 주식, 금융, 미분양, 종합)
- [블로그 시리즈](${SITE_URL}/blog/series): 주제별 연재 콘텐츠
- 카테고리: 부동산(apt), 주식(stock), 금융(finance), 미분양(unsold), 종합(general)
- RSS: ${SITE_URL}/feed.xml

### 계산기 (/calc)
세금, 부동산, 투자, 급여, 대출 등 ${calcCount}종의 무료 온라인 계산기입니다. 2026년 최신 세법과 요율을 반영합니다.

- [계산기 전체](${SITE_URL}/calc): ${calcCatCount}개 카테고리 ${calcCount}종
${calcCategories}

### 커뮤니티 (/feed)
주식, 부동산, 재테크 관련 실시간 사용자 게시글과 토론입니다.

- [커뮤니티 피드](${SITE_URL}/feed): 카테고리별 게시글 (자유, 주식, 부동산, 우리동네, 정보, 재테크)
- [실시간 토론](${SITE_URL}/discuss): 주제별 채팅방

### 데일리 리포트 (/daily)
매일 자동 생성되는 지역별 부동산·주식·경제 요약 리포트입니다.

- [서울 데일리](${SITE_URL}/daily/서울): 서울 지역 일일 리포트
- [부산 데일리](${SITE_URL}/daily/부산): 부산 지역 일일 리포트
- 전국 17개 시도 지원

## 데이터 소스 및 갱신 주기

- 주식 시세 (국내): 금융위원회 공공데이터 API, 매 영업일 갱신
- 주식 시세 (해외): Yahoo Finance API, 매일 갱신
- 청약 정보: 공공데이터포털 (data.go.kr), 실시간 동기화
- 실거래: 국토교통부 실거래가 공개시스템, 매월 갱신
- 미분양: 국토교통부 미분양주택현황 통계, 매월 말 발표
- 재개발: 서울시·경기도·부산시 공공데이터, 매주 갱신
- 단지 정보: 네이버 부동산 API, 주 1회 동기화
- 계산기 세율: 2026년 최신 세법 기준 (국세청, 행정안전부, 국토교통부)

## 면책 고지

카더라에서 제공하는 모든 정보는 투자 참고용이며, 투자 권유가 아닙니다. 투자 판단과 손익은 투자자 본인에게 있습니다. 계산기는 참고용이며 법적 효력이 없습니다. 실제 세금 신고·납부 시 전문가 상담을 권장합니다.

## 기술 정보

- 프레임워크: Next.js 15 (App Router, Server Components)
- 데이터베이스: Supabase (PostgreSQL)
- 호스팅: Vercel (서울 리전 포함)
- 검색: 전문 검색 (FTS) + 벡터 검색
- 실시간: Supabase Realtime (WebSocket)
- SEO: Server-Side Rendering, JSON-LD 구조화 데이터, Open Graph, 사이트맵

## 관련 파일

- [사이트맵](${SITE_URL}/sitemap.xml)
- [RSS 피드](${SITE_URL}/feed.xml)
- [robots.txt](${SITE_URL}/robots.txt)
- [이용약관](${SITE_URL}/terms)
- [개인정보처리방침](${SITE_URL}/privacy)
`;

  return new NextResponse(content.trim(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
