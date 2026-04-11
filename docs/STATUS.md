# 카더라 STATUS — 세션 86 (2026-04-12 18:30 KST)

## 프로덕션
- 실유저: 66명
- UV: ~2,000/일 | PV: ~2,800/일
- DB: 2.0GB/8.4GB
- 최종 커밋: (배포 중)
- 런타임 에러: 0건

## 이번 세션 완료

### SEO 대규모 강화 — 네이버 1위 + 이미지 캐러셀 + 노출면적 극대화

**전체 60개 페이지 감사 실시 → 56개 개선 항목 도출 → 코드 수정 가능한 항목 일괄 처리**

**구조화 데이터 (JSON-LD):**
- ItemList에 `image` 속성 추가: 블로그 목록, 주식 메인/섹터, 아파트 허브/지역, 홈페이지 — 네이버 캐러셀 이미지 노출 핵심
- Organization `sameAs` 채움 (기존 빈 배열)
- Organization `numberOfEmployees`, `areaServed`, `knowsAbout` 확장
- BlogPosting `isPartOf` 추가 (구글 사이트링크 강화)
- FAQPage 추가: stock/themes, movers, market/[code], apt/search, apt/map (layout.tsx 경유)
- BreadcrumbList 추가: calc 허브, calc/[category], faq, shop, press
- stock/compare, stock/search — layout.tsx 생성으로 SEO 공백 해소

**메타 태그:**
- `seo.ts` buildMeta/seoOther에 `naver:written_time`, `naver:updated_time`, `naver:description` 자동 포함
- about/team — naver 메타 추가
- press — naver 메타 추가

**H1 태그:**
- 7개 페이지 H1 추가: /apt, /stock, /feed, /discuss, /search, /faq, /stock/search
- 서버 컴포넌트는 visible H1, 클라이언트 컴포넌트는 sr-only H1

**RSS:**
- layout.tsx RSS alternate → /blog/feed (최고 품질 — media:content + enclosure 포함)
- feed.xml에 content:encoded + enclosure 추가 (기존 xmlns:content 선언만 하고 미사용 수정)

**인프라:**
- Yeti(네이버) Crawl-delay 1→0 (수집 속도 최대화)
- Blog series sitemap lastmod: created_at → updated_at (신선도 신호 개선)

**총 변경: 20개 파일 수정 + 4개 신규 layout.tsx 생성**

## PENDING (코드 외 수동 작업)
- 네이버 블로그 공식 채널 개설 + 주간 요약 발행
- 네이버 카페 개설
- 네이버 플레이스 사업체 등록
- 네이버 서치어드바이저 수집주기 "빠르게" 확인
- 네이버 서치어드바이저 RSS 제출 URL → /blog/feed 변경
- 카카오톡 채널 개설/연동
- 다음 웹마스터도구 등록 확인
- Zum 웹마스터도구 등록
- 네이버 인플루언서 등록 검토
- 네이버TV/유튜브 동영상 채널 개설 검토
- 백링크 확보 전략 수립
# env trigger
