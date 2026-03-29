# 단지백과 설계도면 — /apt/complex

## 1. 컨셉

**"입주 연차별 아파트 생활 가이드"**

기존 부동산 탭(청약/분양중/미분양/재개발/실거래)은 "현재 진행형 현장" 중심.
단지백과는 **"입주 후 N년차 아파트의 현실"**을 다루는 커뮤니티+데이터 페이지.

경쟁 전략: 호갱노노/아실과 같은 축(데이터 플랫폼) 경쟁 회피.
→ **연차별 아파트 생활 정보 + 커뮤니티 의견**이라는 블루오션 공략.

위치: 더보기 메뉴 → 추후 트래픽에 따라 메인 탭 승격 가능

---

## 2. Node가 발급해야 할 API 키 목록

### 필수 (Phase 1~2)

| # | API 이름 | URL | 용도 | 파라미터 |
|---|---------|-----|------|---------|
| 1 | **국토교통부 아파트 전월세 실거래가** | https://www.data.go.kr/data/15126474/openapi.do | 전세/월세 거래 데이터 수집 | LAWD_CD(5자리) + DEAL_YMD(6자리) |
| 2 | **국토교통부 아파트 매매 실거래가 상세** | https://www.data.go.kr/data/15126469/openapi.do | 기존 매매 데이터 보강 (동정보, 해제사유 등) | LAWD_CD + DEAL_YMD |

### 권장 (Phase 2~3)

| # | API 이름 | URL | 용도 |
|---|---------|-----|------|
| 3 | **국토교통부 실거래가 통합** | https://www.data.go.kr/dataset/3050988/openapi.do | 매매+전월세 통합 조회 |
| 4 | **한국부동산원 부동산통계** | https://www.data.go.kr/data/15134761/openapi.do | 지역별 가격지수, 변동률 |

### 발급 방법
1. https://www.data.go.kr 회원가입/로그인
2. 각 API 페이지에서 [활용신청] 클릭
3. 활용 목적: "아파트 실거래가 정보 서비스 개발"
4. **개발계정** 자동 승인 (일일 1,000건) → 이후 **운영계정** 신청 (일일 100만건)
5. 마이페이지 → 인증키 복사 → Vercel 환경변수 등록

### Vercel 환경변수명
```
DATA_GO_KR_API_KEY=발급받은_디코딩_키
```
(기존 crawl-apt-trade에서 이미 data.go.kr 키 사용 중인지 확인 필요.
동일 키로 전월세 API도 호출 가능할 수 있음)

---

## 3. DB 스키마

### 3-1. 신규 테이블: `apt_rent_transactions` (전월세 실거래)

```sql
CREATE TABLE apt_rent_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apt_name TEXT NOT NULL,
  region_nm TEXT NOT NULL,        -- 서울, 경기, 부산 등
  sigungu TEXT NOT NULL,          -- 강남구, 수원시 등
  dong TEXT,                      -- 법정동
  exclusive_area NUMERIC,         -- 전용면적 (㎡)
  rent_type TEXT NOT NULL,        -- 'jeonse' | 'monthly'
  deposit BIGINT,                 -- 보증금 (만원)
  monthly_rent INTEGER DEFAULT 0, -- 월세 (만원, 전세면 0)
  deal_date DATE NOT NULL,        -- 계약일
  floor INTEGER,                  -- 층
  built_year INTEGER,             -- 건축년도
  contract_term TEXT,             -- 계약기간
  renewal_right TEXT,             -- 갱신요구권 사용여부
  source TEXT DEFAULT 'data.go.kr',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 복합 유니크 (중복 방지)
  CONSTRAINT uq_rent_tx UNIQUE (apt_name, sigungu, dong, exclusive_area, deal_date, floor, rent_type, deposit)
);

-- 인덱스
CREATE INDEX idx_rent_tx_region ON apt_rent_transactions(region_nm, sigungu);
CREATE INDEX idx_rent_tx_apt ON apt_rent_transactions(apt_name, sigungu);
CREATE INDEX idx_rent_tx_date ON apt_rent_transactions(deal_date DESC);
CREATE INDEX idx_rent_tx_built_year ON apt_rent_transactions(built_year);
CREATE INDEX idx_rent_tx_type ON apt_rent_transactions(rent_type);
```

### 3-2. 신규 테이블: `apt_complex_profiles` (단지 프로필 — 집계 캐시)

```sql
CREATE TABLE apt_complex_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  apt_name TEXT NOT NULL,
  sigungu TEXT NOT NULL,
  region_nm TEXT NOT NULL,
  dong TEXT,
  built_year INTEGER,
  age_group TEXT,                 -- '신축', '5년차', '10년차', '15년차', '20년차', '25년차', '30년+'
  total_households INTEGER,
  
  -- 최근 거래 요약 (매월 크론으로 갱신)
  latest_sale_price BIGINT,       -- 최근 매매가 (만원)
  latest_sale_date DATE,
  avg_sale_price_pyeong BIGINT,   -- 평당 매매가
  latest_jeonse_price BIGINT,     -- 최근 전세가
  latest_monthly_deposit BIGINT,  -- 최근 월세 보증금
  latest_monthly_rent INTEGER,    -- 최근 월세
  jeonse_ratio NUMERIC,           -- 전세가율 (전세/매매 %)
  
  -- 거래 통계
  sale_count_1y INTEGER DEFAULT 0,    -- 최근 1년 매매 건수
  rent_count_1y INTEGER DEFAULT 0,    -- 최근 1년 전월세 건수
  price_change_1y NUMERIC,            -- 1년 가격 변동률 (%)
  
  -- 메타
  blog_post_count INTEGER DEFAULT 0,  -- 연관 블로그 수
  review_count INTEGER DEFAULT 0,     -- 리뷰 수
  avg_rating NUMERIC,                 -- 평균 평점
  
  -- SEO
  seo_title TEXT,
  seo_description TEXT,
  
  -- 좌표 (apt_transactions 또는 apt_sites에서 복사)
  latitude NUMERIC,
  longitude NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_complex_profile UNIQUE (apt_name, sigungu)
);

CREATE INDEX idx_complex_region ON apt_complex_profiles(region_nm, sigungu);
CREATE INDEX idx_complex_age ON apt_complex_profiles(age_group);
CREATE INDEX idx_complex_price ON apt_complex_profiles(avg_sale_price_pyeong DESC NULLS LAST);
```

### 3-3. 기존 테이블 활용

| 테이블 | 용도 | 연결 방식 |
|--------|------|----------|
| `apt_transactions` | 매매 실거래 원본 | apt_name + sigungu JOIN |
| `apt_sites` | 단지 기본정보 (세대수, 시공사 등) | name + sigungu JOIN |
| `apt_reviews` | 주민 리뷰/평점 | apt_name JOIN |
| `apt_trade_monthly_stats` | 지역별 월간 통계 | region JOIN |
| `blog_posts` | 관련 블로그 포스트 | 카테고리 + 제목 검색 |

---

## 4. 크론 파이프라인

### 4-1. `crawl-apt-rent` (전월세 크롤링) — 신규

```
파일: src/app/api/cron/crawl-apt-rent/route.ts
스케줄: 매일 06:00 KST
maxDuration: 300
Phase: data (GOD MODE)

동작:
1. 기존 LAWD_CODES 맵 (~200개 시군구) 재사용
2. 당월 + 전월 DEAL_YMD로 전월세 API 호출
3. XML 파싱 → apt_rent_transactions UPSERT
4. rent_type 구분: 월세금액 > 0 → 'monthly', else → 'jeonse'

API 호출 예시:
GET https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent
  ?serviceKey={KEY}
  &LAWD_CD=11110
  &DEAL_YMD=202603
  &numOfRows=1000

응답 필드 매핑:
  아파트 → apt_name
  법정동 → dong
  전용면적 → exclusive_area
  보증금액 → deposit
  월세금액 → monthly_rent
  년 + 월 + 일 → deal_date
  층 → floor
  건축년도 → built_year
  계약기간 → contract_term
  갱신요구권사용 → renewal_right
```

### 4-2. `crawl-apt-rent-backfill` (과거 전월세 벌크 수집) — 신규

```
파일: src/app/api/cron/crawl-apt-rent-backfill/route.ts
스케줄: 수동 (어드민 특수작업 버튼)
maxDuration: 300

동작:
1. 과거 3년치 (202301~202603) 월별 × 시군구별 순차 크롤링
2. 하루 호출 한도 고려 → 시군구 10개 × 36개월 = 360 호출/실행
3. 진행상황 DB 기록 (cron_logs)
4. 완료된 시군구+월 스킵 (재시작 가능)

예상 총 호출: 200 시군구 × 36개월 = 7,200건
운영계정 일일 100만건이면 1일 완료 가능
개발계정 일일 1,000건이면 ~8일 소요
```

### 4-3. `crawl-apt-sale-backfill` (과거 매매 벌크 수집) — 신규

```
파일: src/app/api/cron/crawl-apt-sale-backfill/route.ts
스케줄: 수동 (어드민)
maxDuration: 300

동작:
1. 현재 apt_transactions에 2026.01~03만 있음
2. 과거 3년치 (202301~202512) 매매 데이터 벌크 수집
3. 기존 crawl-apt-trade와 동일 API, 동일 LAWD_CODES
4. 기존 apt_transactions에 UPSERT
```

### 4-4. `sync-complex-profiles` (단지 프로필 집계) — 신규

```
파일: src/app/api/cron/sync-complex-profiles/route.ts
스케줄: 매일 07:00 KST (데이터 수집 후)
maxDuration: 120
Phase: process (GOD MODE)

동작:
1. apt_transactions + apt_rent_transactions GROUP BY apt_name, sigungu
2. 연차 계산: 2026 - built_year → age_group 분류
3. 최근 거래가/전세가/월세 집계
4. 전세가율 계산: (latest_jeonse / latest_sale) × 100
5. 1년 가격 변동률 계산
6. apt_reviews 카운트 + 평균 평점 JOIN
7. blog_posts 관련 포스트 카운트
8. apt_complex_profiles UPSERT
```

### 4-5. `blog-complex-guide` (연차별 가이드 블로그) — 신규

```
파일: src/app/api/cron/blog-complex-guide/route.ts
스케줄: 매주 월요일 09:00 KST
maxDuration: 300
Phase: content (GOD MODE)
AI: Sonnet

동작:
1. 연차별 그룹에서 거래 활발한 지역 1개 선택
2. Sonnet에 해당 지역+연차 데이터 제공
3. "부산 사하구 입주 15년차 아파트 종합 가이드" 형태 포스트 생성
4. safeBlogInsert로 저장

예시 제목:
- "서울 강서구 입주 10년차 아파트 — 시세·전세·유지보수 총정리"
- "경기 군포시 20년차 아파트 현실 — 재건축 기대 vs 실거래 추이"
```

---

## 5. 페이지 구조

### 5-1. URL 설계

```
/apt/complex                          → 메인 (지역/연차 필터 + 검색)
/apt/complex/[region]                 → 지역별 (예: 서울, 부산, 경기)
/apt/complex/[region]/[sigungu]       → 시군구별 (예: 강남구, 사하구)
/apt/complex/detail/[slug]            → 개별 단지 상세
```

slug 생성 규칙: `{apt_name}-{sigungu}` → URL-safe 변환
예: `래미안-강남-강남구` → `raemian-gangnam-gangnamgu`
또는 한글 slug: `래미안강남-강남구` (기존 apt_sites slug 패턴 따름)

### 5-2. 메인 페이지 `/apt/complex`

```
┌─────────────────────────────────────────────┐
│ 🏢 단지백과                                  │
│ 입주 연차별 아파트 종합 가이드                │
├─────────────────────────────────────────────┤
│ [지역 선택 ▼] [연차 필터 ▼] [정렬 ▼] [🔍]   │
├─────────────────────────────────────────────┤
│                                             │
│ ┌── 연차별 시세 비교 차트 ──────────────┐   │
│ │ 신축 4.2억 ████████████████████       │   │
│ │ 5년  4.0억 ███████████████████        │   │
│ │ 10년 3.2억 ████████████████           │   │
│ │ 15년 3.9억 ██████████████████         │   │
│ │ 20년 2.5억 ████████████               │   │
│ │ 30년 3.6억 █████████████████          │   │
│ └───────────────────────────────────────┘   │
│                                             │
│ ┌── 단지 카드 그리드 ──────────────────┐    │
│ │ ┌────────┐ ┌────────┐ ┌────────┐    │    │
│ │ │래미안   │ │힐스테이│ │○○아파트│    │    │
│ │ │강남구   │ │수영구  │ │사하구  │    │    │
│ │ │15년차   │ │10년차  │ │25년차  │    │    │
│ │ │매매 13억│ │매매 4억│ │매매 2억│    │    │
│ │ │전세 8억 │ │전세 2억│ │전세 1억│    │    │
│ │ │⭐4.2(3) │ │⭐3.8(1)│ │리뷰없음│    │    │
│ │ └────────┘ └────────┘ └────────┘    │    │
│ └──────────────────────────────────────┘    │
│                                             │
│ ┌── 관련 블로그 ───────────────────────┐    │
│ │ 📰 서울 강서구 10년차 아파트 시세 분석│    │
│ │ 📰 부산 재건축 대상 30년+ 단지 목록   │    │
│ └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 5-3. 지역별 페이지 `/apt/complex/[region]`

```
헤더: "서울 단지백과 — 입주 연차별 아파트 가이드"
내용:
- 시군구 선택 칩 (강남구, 서초구, 송파구...)
- 해당 지역 연차별 평균 시세 차트
- 단지 카드 그리드 (필터/정렬)
- 관련 블로그 포스트
```

### 5-4. 단지 상세 `/apt/complex/detail/[slug]`

```
┌─────────────────────────────────────────────┐
│ 래미안 ○○ — 서울 강남구                      │
│ 입주 15년차 | 1,200세대 | 시공 삼성물산       │
├─────────────────────────────────────────────┤
│                                             │
│ ┌── 시세 요약 ─────────────────────────┐    │
│ │ 매매    │ 전세    │ 월세    │ 전세가율│    │
│ │ 13.2억  │ 8.1억  │ 1억/80  │ 61.3%  │    │
│ └──────────────────────────────────────┘    │
│                                             │
│ ┌── 가격 추이 차트 (3년) ──────────────┐    │
│ │  매매 ─── 전세 --- 월세보증금 ···    │    │
│ │ (recharts LineChart)                 │    │
│ └──────────────────────────────────────┘    │
│                                             │
│ ┌── 최근 실거래 내역 ─────────────────┐    │
│ │ 2026.03 | 84㎡ | 13.2억 | 12층 | 매매│   │
│ │ 2026.02 | 84㎡ | 8.1억  | 8층  | 전세│   │
│ │ 2026.01 | 59㎡ | 1억/80 | 3층  | 월세│   │
│ └──────────────────────────────────────┘    │
│                                             │
│ ┌── 입주 15년차 체크리스트 ────────────┐    │
│ │ ✅ 방수 점검 (발코니, 욕실)          │    │
│ │ ✅ 배관 노후 확인                    │    │
│ │ ✅ 엘리베이터 교체 이력              │    │
│ │ ✅ 외벽 크랙 여부                    │    │
│ │ ✅ 주차장 구조물 점검                │    │
│ └──────────────────────────────────────┘    │
│                                             │
│ ┌── 주민 리뷰 ────────────────────────┐    │
│ │ ⭐⭐⭐⭐ "관리 잘 되는 편"          │    │
│ │ 장점: 교통 편리, 학군 좋음           │    │
│ │ 단점: 주차 부족                      │    │
│ │                                      │    │
│ │ [리뷰 작성하기]                      │    │
│ └──────────────────────────────────────┘    │
│                                             │
│ ┌── 관련 블로그 ──────────────────────┐    │
│ │ 📰 강남구 15년차 아파트 시세 분석    │    │
│ └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

---

## 6. SEO 전략

### 6-1. 메타 태그

```tsx
// /apt/complex/[region]/[sigungu]
export async function generateMetadata({ params }) {
  return {
    title: `${sigungu} 단지백과 — 입주 연차별 아파트 시세 가이드 | 카더라`,
    description: `${region} ${sigungu} 아파트를 입주 연차별로 비교. 매매·전세·월세 실거래가, 가격 추이, 주민 리뷰 한눈에.`,
    openGraph: {
      title: `${sigungu} 단지백과 | 카더라`,
      description: `${sigungu} 입주 연차별 아파트 종합 가이드`,
      images: [`/api/og?title=${sigungu} 단지백과&category=apt&design=2`],
    },
    other: {
      'naver:author': '카더라 부동산팀',
    },
  };
}
```

### 6-2. JSON-LD 구조화 데이터

```json
// 메인 페이지: ItemList
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "서울 강남구 단지백과",
  "description": "강남구 입주 연차별 아파트 목록",
  "numberOfItems": 56,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "Place",
        "name": "래미안 ○○",
        "address": { "@type": "PostalAddress", "addressRegion": "서울", "addressLocality": "강남구" },
        "geo": { "@type": "GeoCoordinates", "latitude": 37.xxx, "longitude": 127.xxx }
      }
    }
  ]
}

// 단지 상세: Place + GeoCoordinates + AggregateRating
{
  "@context": "https://schema.org",
  "@type": "Place",
  "name": "래미안 ○○",
  "address": { ... },
  "geo": { ... },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.2",
    "reviewCount": "3"
  }
}
```

### 6-3. 사이트맵

```
기존 sitemap.xml에 추가:
/apt/complex
/apt/complex/서울
/apt/complex/서울/강남구
/apt/complex/서울/서초구
...
/apt/complex/detail/래미안○○-강남구
```

예상 URL 수: ~200 시군구 + ~2,379 단지 상세 = ~2,600 페이지

### 6-4. 롱테일 SEO 키워드 (블루오션)

```
"부산 사하구 입주 10년차 아파트 시세"
"경기도 군포시 20년차 아파트 전세 가격"
"서울 강서구 재건축 대상 아파트 목록"
"아파트 입주 15년차 점검 항목"
"신축 아파트 vs 구축 아파트 가격 비교 2026"
"전세가율 높은 아파트 지역별 순위"
"입주 30년 이상 아파트 재건축 가능성"
```

---

## 7. 구현 Phase

### Phase 1 — 즉시 가능 (데이터 확장 전)

```
소요: 1~2 세션
사전조건: 없음 (기존 데이터만 사용)

구현:
1. /apt/complex 메인 페이지
   - apt_transactions에서 built_year 기준 연차 분류
   - 지역별 → 연차별 필터
   - 단지 카드 (이름, 지역, 연차, 최근 매매가)
   - 연차별 평균 시세 비교 차트

2. /apt/complex/[region] 지역별 페이지
3. /apt/complex/[region]/[sigungu] 시군구별 페이지
4. 더보기 메뉴에 "🏢 단지백과" 추가
5. SEO 메타 + JSON-LD + OG 이미지
6. 관련 블로그 연결 (기존 20,000+ 포스트)

데이터 범위: 매매만, 3개월, 2,379개 단지
```

### Phase 2 — 데이터 확장 (API 키 발급 후)

```
소요: 2~3 세션
사전조건: DATA_GO_KR_API_KEY 발급

구현:
1. apt_rent_transactions 테이블 생성
2. crawl-apt-rent 크론 (일일 전월세 수집)
3. crawl-apt-rent-backfill (과거 3년 벌크)
4. crawl-apt-sale-backfill (과거 3년 매매 벌크)
5. sync-complex-profiles 크론 (단지 프로필 집계)
6. 단지 상세 페이지에 전세/월세 데이터 추가
7. 가격 추이 차트 (recharts)
8. 전세가율 표시
```

### Phase 3 — 커뮤니티 + 차별화

```
소요: 2~3 세션
사전조건: Phase 2 완료

구현:
1. 주민 리뷰 시스템 활성화 (apt_reviews 연결)
2. AI 시드 리뷰 (Sonnet으로 초기 콘텐츠)
3. 입주 연차별 유지보수 체크리스트 콘텐츠
4. 감가율 분석 (연차별 평당가 추이)
5. 재건축 가능성 점수 (30년+ 단지)
6. blog-complex-guide 크론 (주간 연차별 가이드 블로그)
7. 단지 비교 기능 (A vs B 나란히)
```

---

## 8. 컴포넌트 설계

### 8-1. 신규 파일 목록

```
src/app/(main)/apt/complex/
├── page.tsx                          # 메인 (SSR)
├── ComplexClient.tsx                  # 클라이언트 (필터/차트)
├── [region]/
│   └── page.tsx                      # 지역별 (SSR)
│   └── [sigungu]/
│       └── page.tsx                  # 시군구별 (SSR)
└── detail/
    └── [slug]/
        └── page.tsx                  # 단지 상세 (SSR)

src/components/complex/
├── ComplexCard.tsx                    # 단지 카드
├── ComplexFilter.tsx                  # 필터 UI
├── AgePriceChart.tsx                  # 연차별 시세 차트
├── PriceTrendChart.tsx               # 가격 추이 차트
├── ComplexReviews.tsx                 # 리뷰 섹션
└── MaintenanceChecklist.tsx          # 유지보수 체크리스트

src/app/api/cron/
├── crawl-apt-rent/route.ts           # Phase 2
├── crawl-apt-rent-backfill/route.ts  # Phase 2
├── crawl-apt-sale-backfill/route.ts  # Phase 2
├── sync-complex-profiles/route.ts    # Phase 2
└── blog-complex-guide/route.ts       # Phase 3
```

### 8-2. API 라우트

```
GET /api/complex/list
  ?region=서울&sigungu=강남구&age=10년차&sort=price_desc&page=1
  → apt_complex_profiles 조회

GET /api/complex/[slug]
  → 단지 상세 + 거래 내역 + 리뷰

GET /api/complex/chart
  ?region=서울&sigungu=강남구
  → 연차별 평균 시세 차트 데이터

GET /api/complex/trend/[slug]
  → 가격 추이 시계열 데이터
```

---

## 9. 연차 분류 로직

```typescript
function getAgeGroup(builtYear: number): string {
  const currentYear = new Date().getFullYear(); // 2026
  const age = currentYear - builtYear;
  
  if (age <= 3) return '신축';
  if (age <= 8) return '5년차';
  if (age <= 13) return '10년차';
  if (age <= 18) return '15년차';
  if (age <= 23) return '20년차';
  if (age <= 28) return '25년차';
  return '30년+';
}

const AGE_GROUPS = ['신축', '5년차', '10년차', '15년차', '20년차', '25년차', '30년+'];
```

---

## 10. 현재 데이터 현실 vs 목표

| 항목 | 현재 | Phase 2 후 |
|------|------|-----------|
| 매매 거래 | 5,408건 (3개월) | ~50,000건 (3년) |
| 전세 거래 | 0건 | ~60,000건 (3년) |
| 월세 거래 | 0건 | ~40,000건 (3년) |
| 고유 단지 | 2,379개 | ~5,000+개 |
| 시군구 | 99개 | ~200개 |
| 리뷰 | 0건 | AI 시드 ~500건 |
| 가격 추이 기간 | 3개월 | 3년 |

---

## 11. 더보기 메뉴 추가

```typescript
// Navigation.tsx MORE_ITEMS에 추가
{ href: '/apt/complex', emoji: '🏢', label: '단지백과' },
```

---

## 12. 작업 순서 요약

```
[Node 선행]
1. 공공데이터포털 API 키 발급 (전월세 + 매매 상세)
2. Vercel 환경변수 등록: DATA_GO_KR_API_KEY

[Claude Phase 1] — API 키 없이 즉시 시작
1. /apt/complex 메인 + 지역별 + 시군구별 페이지
2. apt_transactions 기반 단지 카드 + 필터
3. 연차별 시세 비교 차트
4. SEO 메타 + JSON-LD + OG
5. 더보기 메뉴 추가
6. 관련 블로그 연결

[Claude Phase 2] — API 키 발급 후
1. DB 마이그레이션 (apt_rent_transactions, apt_complex_profiles)
2. crawl-apt-rent 크론
3. backfill 크론 (매매 + 전월세 과거 3년)
4. sync-complex-profiles 크론
5. 단지 상세 페이지 풀 구현
6. 가격 추이 차트

[Claude Phase 3] — 데이터 축적 후
1. 리뷰 시스템
2. AI 시드 리뷰
3. 유지보수 체크리스트
4. blog-complex-guide 크론
5. 단지 비교 기능
```
