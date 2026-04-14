# 카더라 재개발·재건축 섹션 강화 — 풀스택 최종 설계안
> 2026-04-14 · 전수 코드감사 + DB스키마 + API소스 + 경쟁분석 + SEO + 전환연결 통합

---

## 0. 진단 요약

### 현재 상태
| 항목 | 수치 | 문제 |
|------|------|------|
| 총 프로젝트 | 202건 | 서울만 400+건 존재 → **절반 이상 누락** |
| 세대수 보유 | 36건 (18%) | 사업성 판단 불가 |
| 좌표 보유 | 35건 (17%) | 지도 기능 불가 |
| 용적률/건폐율 | 0건 (0%) | **건축 지표 전무** |
| 시공사 | 13건 (6%) | 투자 판단 핵심 누락 |
| 전용 라우트 | 없음 | `/apt/redev` 미존재 → SEO 0 |
| 네비게이션 | 없음 | 재개발 메뉴 미노출 |
| sitemap | 없음 | 검색엔진 미인덱싱 |
| 실거래 연동 | 없음 | 구역 내 시세 파악 불가 |
| 블로그 카테고리 | 0편(redev) | 348편이 apt 카테고리로 혼재 |

### 핵심 발견 (기존 분석에서 놓친 것)
1. **서울 API가 빈약한 걸 쓰고 있음** — `upisRebuild`(기본 리스트)만 사용. `OA-2253`(추진경과정보)에 용적률/건폐율/세대수/최고층 필드가 있는데 미사용
2. **도시환경정비사업을 주택재개발로 혼합** — TYPE_MAP에서 `도시환경정비사업지구`를 `재개발`로 매핑. 상업지구가 주거 투자 리스트에 섞임
3. **Full refresh가 enriched 데이터 파괴** — 매주 월요일 `DELETE + INSERT` → AI 요약, 좌표, 세대수 등 수동 보강 데이터가 매주 날아감
4. **STAGE_ORDER에 '추진위' 누락** — 현실의 첫 단계인 '추진위원회 구성'이 6단계에 없음
5. **경기도 크롤러가 API 서비스명 추측** — 4개 후보를 순회하며 찾는 불안정 구조
6. **전국 크롤러에 경기도 주요 시군구 대부분 누락** — 화성, 성남, 수원, 용인, 고양 등 미포함
7. **apt_sites ↔ redevelopment_projects 연결 불안정** — source_ids.redev_id로 연결하지만, 서울 Full refresh 시 ID가 변경됨
8. **interest_count가 모두 0** — 관심 등록 기능이 실질적으로 미작동
9. **RedevProject 타입에 area_sqm 누락** — DB에는 있지만 타입에 없어서 `(r as any).area_sqm` 캐스팅 사용 중

---

## 1. 데이터 레이어

### 1-1. DB 스키마 확장

```sql
ALTER TABLE redevelopment_projects
  -- 분류 강화
  ADD COLUMN IF NOT EXISTS sub_type text DEFAULT '주택재개발',
  -- CHECK (sub_type IN ('주택재개발','주택재건축','도시환경정비','가로주택정비','소규모재건축'))
  
  -- 건축 지표 (서울 OA-2253에서 수집)
  -- floor_area_ratio, building_coverage, max_floor 이미 존재 (all NULL)
  ADD COLUMN IF NOT EXISTS existing_households integer,  -- 기존(철거) 세대수
  
  -- 크로스데이터
  ADD COLUMN IF NOT EXISTS blog_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_trade_price integer,       -- 구역 내 최근 실거래 평균 (만원)
  ADD COLUMN IF NOT EXISTS recent_trade_count integer DEFAULT 0,
  
  -- 변경 추적
  ADD COLUMN IF NOT EXISTS last_stage_change timestamptz,
  ADD COLUMN IF NOT EXISTS previous_stage text,
  
  -- 안정적 식별자 (Full refresh 대응)
  ADD COLUMN IF NOT EXISTS external_id text UNIQUE;  -- API 원본 사업코드 (PRJC_CD 등)

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_redev_region_stage ON redevelopment_projects (region, stage) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_redev_external_id ON redevelopment_projects (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_redev_sub_type ON redevelopment_projects (sub_type) WHERE is_active = true;
```

### 1-2. RedevProject 타입 수정

```typescript
// src/types/apt.ts
export interface RedevProject {
  id: number;
  name: string;
  district_name: string;
  region: string;
  sigungu: string | null;
  address: string | null;
  project_type: string;       // '재개발' | '재건축'
  sub_type: string | null;    // '주택재개발' | '주택재건축' | '도시환경정비' | ...
  stage: string | null;
  total_households: number | null;
  existing_households: number | null;  // 신규
  area_sqm: number | null;            // 기존 (r as any) → 정식 필드
  land_area: number | null;
  floor_area_ratio: number | null;
  building_coverage: number | null;
  max_floor: number | null;           // number → number | null
  estimated_move_in: string | null;
  expected_completion: string | null;
  developer: string | null;
  constructor: string | null;
  nearest_station: string | null;
  nearest_school: string | null;
  key_features: string | null;
  ai_summary: string | null;
  notes: string | null;
  external_id: string | null;         // 신규
  // 크로스데이터 (enrich 크론에서 채움)
  blog_count: number;                 // 신규
  avg_trade_price: number | null;     // 신규
  recent_trade_count: number;         // 신규
  last_stage_change: string | null;   // 신규
  previous_stage: string | null;      // 신규
}
```

### 1-3. STAGE_ORDER 확장

```typescript
// src/app/(main)/apt/tabs/apt-utils.ts
export const STAGE_ORDER = [
  '추진위',        // 추가: 추진위원회 구성 (실제 초기 단계)
  '정비구역지정',
  '조합설립',
  '사업시행인가',
  '관리처분',
  '착공',
  '준공',          // 추가: 완공/입주 단계
];
```

---

## 2. 데이터 수집 (크롤러)

### 2-1. 서울 크롤러 개편 — `upisRebuild` → `RedevCmpnnStatus` (OA-2253) 병합

**핵심**: 기존 API 교체가 아니라 **병합**. `upisRebuild`로 기본 목록 + `RedevCmpnnStatus`로 상세 필드 보강.

```
// 서울 크롤러 로직 변경:
1단계: upisRebuild에서 전체 목록 (district_name, PRJC_CD, SCLSF, stage)
2단계: RedevCmpnnStatus에서 추가 필드 매칭
       → 용적률(BLBD_ARA_RT), 건폐율(BILDNG_ARA_RT), 
       → 기존세대수(EXST_HSHLD_CO), 계획세대수(PLNNG_HSHLD_CO),
       → 최고층(MXMM_FLR), 시공사(CNSTRTR_NM)
3단계: UPSERT (external_id = PRJC_CD 기준) — Full refresh 제거

// 도시환경정비 분리:
TYPE_MAP 수정:
  '도시환경정비사업지구' → project_type: '재개발', sub_type: '도시환경정비'
  '주택재개발사업지구' → project_type: '재개발', sub_type: '주택재개발'
  '주택재건축사업지구' → project_type: '재건축', sub_type: '주택재건축'
```

**Full refresh → UPSERT 변경 이유**: 
현재 `DELETE → INSERT` 패턴으로 매주 모든 데이터가 교체되면서:
- `ai_summary` 재생성 비용 발생
- `latitude/longitude` 좌표 유실
- `apt_sites.source_ids.redev_id` 깨짐
- `blog_count`, `avg_trade_price` 유실

```typescript
// UPSERT 패턴:
const { error } = await supabase.from('redevelopment_projects').upsert(
  mapped,
  { onConflict: 'external_id', ignoreDuplicates: false }
);
// 새로 수집된 필드만 덮어쓰고, AI/좌표/크로스데이터는 보존
```

### 2-2. 전국 크롤러 시군구 확대

```typescript
// crawl-nationwide-redev — 추가할 코드 (검증된 행정구역 코드)
const ADDITIONAL_CODES = {
  '경기': { 
    name: '경기', 
    codes: { 
      '수원시': '41111', '성남시': '41131', '고양시': '41281',
      '용인시': '41463', '화성시': '41590', '남양주시': '41360',
      '파주시': '41480', '시흥시': '41390', '안산시': '41271',
      '안양시': '41171', '부천시': '41190', '의정부시': '41150',
      '평택시': '41220', '하남시': '41450', '광명시': '41210',
      '구리시': '41310', '오산시': '41370',
    }
  },
  '세종': { name: '세종', codes: { '세종시': '36110' } },
};
// 기존 SIGUNGU_CODES에 merge
```

### 2-3. redev-enrich 크론 신설

```
매일 1회 실행 (KST 06:30):

1. blog_count 업데이트
   SELECT r.id, count(b.id) as cnt
   FROM redevelopment_projects r
   LEFT JOIN blog_posts b ON b.tags && ARRAY[r.district_name]
   WHERE r.is_active = true
   GROUP BY r.id

2. avg_trade_price 업데이트
   → redevelopment_projects.sigungu + 동(dong 추출) 기준
   → apt_transactions에서 최근 6개월 매매 평균가
   → 다세대/빌라 우선 (exclusive_area < 85)

3. stage 변경 감지
   → previous_stage ≠ stage인 경우 last_stage_change 갱신
   → 변경 발생 시 apt_site_interests → push/email 알림

4. ai_summary 미보유 건 생성
   → Claude Haiku로 1건당 ~200자 요약
   → 하루 최대 20건 (비용 관리)
```

---

## 3. 프론트엔드

### 3-1. 카드 컴팩트 리디자인

**기존 → 새 구조 (정보 밀도 2x)**

```
┌─────────────────────────────────────────────────────┐
│ [주택재개발] 조합설립 ████████░░░░ 43%  서울 영등포구  │  ← 1행: 유형뱃지+단계바+지역
│                                                       │
│ 신길10구역 재개발                              ☆     │  ← 2행: 이름 (bold)
│                                                       │
│ 🏢 3,200세대(기존 1,800)  📐 45천m²  🏗️ GS건설      │  ← 3행: 핵심 KPI
│ 📊 용적률 299%  🏠 건폐율 45%  🔝 35층               │  ← 4행: 건축지표 (신규)
│                                                       │
│ 💰 구역 내 최근 거래 평균 2.1억 (3건)                 │  ← 5행: 실거래 연동 (신규)
│ 📝 관련 분석 3편  ·  🔔 12명 관심등록                 │  ← 6행: 콘텐츠+관심 (신규)
│                                                       │
│ 🤖 신통기획 대상, 2027년 입주 예상. 분담금 추정 1.5억 │  ← 7행: AI 요약 1줄
└─────────────────────────────────────────────────────┘
```

**제거**: OG 이미지 스트립 (정보 0), 6단계 도트 타임라인 (진행바로 압축)
**추가**: 건축지표, 기존세대수, 실거래, 블로그수, 관심수
**빈 데이터 처리**: 값이 NULL이면 해당 행 자체를 숨김 (빈 "미확정" 표시 제거)

### 3-2. 도시환경정비 분리 UI

```
RedevTab 상단 필터에 추가:
[전체] [주택재개발] [주택재건축] [도시환경정비]
                                ↑ 회색 처리, 기본 숨김

기본 뷰: 주택재개발 + 주택재건축만 표시
"도시환경정비 {N}건" 접힌 섹션으로 하단 배치
```

### 3-3. 정렬 옵션 추가

```
현재: 이름순 + 미상 하단 정렬만
추가:
  [최신순] — last_stage_change DESC (단계 변경 최근순)
  [세대순] — total_households DESC  
  [진행순] — stage 진행률 DESC (착공 > 관리처분 > ...)
  [인기순] — page_views DESC (apt_sites 연동)
```

### 3-4. `/apt/redev` 전용 랜딩 페이지 (신규)

```
src/app/(main)/apt/redev/page.tsx

구조:
1. 히어로: "전국 재개발·재건축 현황" + 총 N건 + 주간 변경 하이라이트
2. 지역별 요약 카드 (클릭 → 해당 지역 필터)
   [서울 400건] [경기 100건] [부산 25건] [인천 30건] ...
3. 최근 단계 변경 프로젝트 TOP 5
4. 인기 구역 TOP 10 (블로그 조회수 기반)
5. FAQ 리치스니펫 (재개발 절차, 분담금, 입주권)
6. 관련 블로그 최신 5편

SEO:
  title: "재개발 재건축 현황 — 전국 {N}개 구역 진행상황 (2026)"
  JSON-LD: WebPage + FAQPage + BreadcrumbList
  sitemap 자동 포함
```

### 3-5. `/apt/redev/[region]` 지역별 페이지 (신규)

```
src/app/(main)/apt/redev/[region]/page.tsx

동적 라우트: /apt/redev/서울, /apt/redev/부산, /apt/redev/경기 등

구조:
1. "{지역} 재개발·재건축 현황" 히어로
2. 단계별 파이프라인 (기존 RedevTab의 파이프라인 재사용)
3. 시군구별 분포 차트
4. 프로젝트 리스트 (기존 카드 컴포넌트 재사용)
5. 해당 지역 관련 블로그 포스트

SEO 타겟:
  "서울 재개발 현황" / "부산 재건축" / "경기 재개발" 등
  → 각 키워드 월 1,000~5,000 검색량 추정
```

### 3-6. 네비게이션 연결

```
Navigation.tsx — apt 드롭다운 메뉴에 추가:
  부동산
  ├── 청약 일정 (/apt)
  ├── 미분양 (/apt?tab=unsold)
  ├── 재개발·재건축 (/apt/redev)  ← 신규
  ├── 실거래가 (/apt?tab=trade)
  ├── 지도 (/apt/map)
  └── 단지백과 (/apt/complex)
```

---

## 4. SEO 전략

### 4-1. sitemap 추가

```typescript
// src/app/sitemap.ts에 추가:
// /apt/redev (정적)
{ url: `${BASE}/apt/redev`, lastmod: new Date(), changefreq: 'weekly', priority: 0.8 }

// /apt/redev/[region] (동적)
const regions = ['서울', '경기', '부산', '인천', '대구', '대전', '광주', '울산', '경남', '경북', '충남', '충북', '전남', '전북', '강원', '세종', '제주'];
regions.map(r => ({ url: `${BASE}/apt/redev/${encodeURIComponent(r)}`, lastmod, changefreq: 'weekly', priority: 0.7 }))
```

### 4-2. 블로그 카테고리 정비

```sql
-- 348편의 재개발 블로그를 redev 카테고리로 이동
UPDATE blog_posts 
SET category = 'redev'
WHERE tags && ARRAY['재개발','재건축','정비사업']
  AND category = 'apt';
-- 주의: blog_posts 삭제/수정 금지 규칙. category 변경은 허용.
```

### 4-3. 내부 링크 강화

```
블로그 포스트 → /apt/redev/{region} 역링크
/apt/redev 랜딩 → 관련 블로그 포스트 자동 링크
/apt/[id] 상세 → 동일 구역 블로그 포스트 연결
RedevTab 카드 → 블로그 편수 표시 + 클릭 시 블로그 목록
```

### 4-4. JSON-LD 스키마

```json
// /apt/redev 페이지
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "재개발 재건축 현황",
  "description": "전국 {N}개 재개발·재건축 구역의 진행 단계, 시공사, 세대수 정보",
  "breadcrumb": { "@type": "BreadcrumbList", "itemListElement": [...] }
}

// FAQ 리치스니펫 (검색 결과 확장)
{
  "@type": "FAQPage",
  "mainEntity": [
    { "name": "재개발과 재건축의 차이는?", "acceptedAnswer": {...} },
    { "name": "재개발 분담금이란?", "acceptedAnswer": {...} },
    { "name": "재개발 투자 시 주의할 점은?", "acceptedAnswer": {...} },
    { "name": "신통기획이란?", "acceptedAnswer": {...} },
    { "name": "재건축 초과이익 환수제란?", "acceptedAnswer": {...} },
  ]
}
```

---

## 5. 크로스데이터 연동

### 5-1. 구역 내 실거래 연동

```typescript
// redev-enrich 크론 또는 실시간 API에서:

// 1. redevelopment_projects의 sigungu + address에서 동(dong) 추출
const dong = extractDong(project.address); // "영등포구 신길동" → "신길동"

// 2. apt_transactions에서 해당 동의 최근 거래 조회
const trades = await sb.from('apt_transactions')
  .select('deal_amount, exclusive_area, deal_date')
  .eq('sigungu', project.sigungu)
  .eq('dong', dong)
  .lt('exclusive_area', 85) // 다세대/빌라 크기
  .gte('deal_date', sixMonthsAgo)
  .order('deal_date', { ascending: false })
  .limit(10);

// 3. 평균 매입가 계산
const avgPrice = Math.round(trades.reduce((s, t) => s + t.deal_amount, 0) / trades.length);

// 4. redevelopment_projects 업데이트
await sb.from('redevelopment_projects')
  .update({ avg_trade_price: avgPrice, recent_trade_count: trades.length })
  .eq('id', project.id);
```

### 5-2. 블로그 연동

```typescript
// 구역명 → 블로그 태그 매칭
const blogCount = await sb.from('blog_posts')
  .select('id', { count: 'exact', head: true })
  .contains('tags', [project.district_name])
  .eq('is_published', true);
```

### 5-3. apt_sites 연결 안정화

```
현재 문제: source_ids.redev_id가 Full refresh로 변경됨
해결: external_id 기반으로 연결

sync-apt-sites 크론 수정:
  기존: source_ids.redev_id = redevelopment_projects.id
  변경: source_ids.redev_external_id = redevelopment_projects.external_id
  
이렇게 하면 Full refresh(ID 변경)에도 연결 유지
```

---

## 6. 전환 연결

### 6-1. 재개발 전용 CTA

```
SmartSectionGate CATEGORY_BENEFITS 추가:
  redev: {
    headline: '이 구역의 분담금 추정과 투자 분석을',
    bullets: ['단계 변경 알림 (무료)', '분담금 추정 계산기', '전체 분석 이어 읽기'],
    btnText: '카카오로 무료 가입',
  }
```

### 6-2. 관심구역 등록 → 가입

```
RedevTab 카드의 ☆ 버튼:
  비로그인 → /login?redirect=/apt?tab=redev&source=redev_interest
  로그인 → apt_site_interests INSERT + 50P

LoginClient MSG 추가:
  redev_interest: { icon: '🏗️', text: '가입하면 이 구역의 단계 변경 알림을 받을 수 있어요' }
```

### 6-3. /apt/redev 랜딩 CTA

```
비로그인 → 인기구역 3개만 표시 + "전체 {N}개 구역 보기" 가입 유도
LoginGate 적용: 분담금 추정, 구역 비교 등 고부가 기능
```

---

## 7. 어드민 모니터링

### 7-1. GrowthTab 재개발 섹션 추가

```
🏗️ 재개발 데이터 현황
├── 총 프로젝트: {N}건 (주택 {n1} · 도시환경 {n2})
├── 데이터 품질: 세대수 {%} · 좌표 {%} · AI요약 {%} · 시공사 {%}
├── 이번주 단계변경: {N}건
└── 관심등록: {N}명
```

### 7-2. FocusTab 재개발 알림

```
단계 변경 감지 시 FocusTab 경고:
"🏗️ 신길10구역: 조합설립 → 사업시행인가 (오늘)"
```

---

## 8. 리스크 & 제약

### 8-1. API 키 의존성

| API | 키 환경변수 | 현재 상태 | 필요 조치 |
|-----|-----------|---------|---------|
| 서울 열린데이터 | SEOUL_DATA_API_KEY | ✅ Vercel에 존재 | OA-2253 접근 확인 |
| 경기 열린데이터 | GG_DATA_API_KEY | ✅ | 추가 서비스명 확인 |
| 부산 공공데이터 | BUSAN_DATA_API_KEY | ✅ | 변경 없음 |
| 전국 data.go.kr | MOLIT_STAT_API_KEY | ✅ | 변경 없음 |
| 카카오 로컬 | KAKAO_REST_API_KEY | ✅ | geocode 확대 |

### 8-2. Full Refresh → UPSERT 전환 리스크

```
리스크: 삭제된 프로젝트가 is_active = true로 남음
대응: API에 없는 external_id는 is_active = false로 마킹
     → "API 미확인" 상태로 표시 (완전 삭제 X)
```

### 8-3. 데이터 정합성

```
서울 upisRebuild: 구역명이 RGN_NM 필드
서울 OA-2253: 구역명이 다른 필드명일 수 있음
→ API 실제 응답 테스트 후 필드 매핑 확정 필요
```

### 8-4. 비용 영향

```
AI 요약 생성: 하루 20건 × Haiku ~$0.002 = $0.04/일
geocode: 카카오 API 무료 한도 30만건/월 → 충분
추가 API 호출: 서울 OA-2253 → 무료 (공공데이터)
```

---

## 9. 실행 우선순위

### Phase A: 데이터 기반 (필수 선행, ~3시간)
| # | 작업 | 파일 | 영향 |
|---|------|------|------|
| A-1 | DB 스키마 확장 (8컬럼 + 2인덱스) | migration | 데이터 기반 |
| A-2 | RedevProject 타입 수정 | types/apt.ts | 타입 안전성 |
| A-3 | STAGE_ORDER 확장 (추진위+준공) | apt-utils.ts | 정확한 단계 |
| A-4 | 서울 크롤러 UPSERT 전환 + 도시환경 분리 | crawl-seoul-redev | **핵심** |
| A-5 | 전국 크롤러 시군구 확대 | crawl-nationwide-redev | 모수 확대 |

### Phase B: 프론트엔드 + SEO (~4시간)
| # | 작업 | 파일 | 영향 |
|---|------|------|------|
| B-1 | RedevTab 카드 컴팩트 리디자인 | RedevTab.tsx | **UX 핵심** |
| B-2 | `/apt/redev` 전용 랜딩 | 신규 page.tsx | SEO 유입 |
| B-3 | `/apt/redev/[region]` 지역별 | 신규 page.tsx | 롱테일 SEO |
| B-4 | Navigation 재개발 메뉴 추가 | Navigation.tsx | 접근성 |
| B-5 | sitemap + JSON-LD | sitemap.ts | 인덱싱 |

### Phase C: 데이터 보강 + 연동 (~2시간)
| # | 작업 | 파일 | 영향 |
|---|------|------|------|
| C-1 | redev-enrich 크론 신설 | 신규 route.ts | 데이터 품질 |
| C-2 | 블로그 카테고리 이동 (348편) | DB migration | SEO 연결 |
| C-3 | apt_sites 연결 안정화 | sync-apt-sites | 상세페이지 |
| C-4 | 전환 CTA 연결 | SmartSectionGate, LoginClient | 가입 유도 |

### Phase D: 어드민 + 알림 (~1시간)
| # | 작업 | 파일 | 영향 |
|---|------|------|------|
| D-1 | GrowthTab 재개발 현황 | GrowthTab.tsx | 운영 가시성 |
| D-2 | 단계 변경 알림 | redev-enrich + notification-hub | 리텐션 |

---

## 10. 예상 결과

| 지표 | 현재 | Phase A 후 | Phase B+C 후 |
|------|------|-----------|-------------|
| 총 프로젝트 | 202 | **600~800** | 600~800 |
| 세대수 보유율 | 18% | **50~70%** | 50~70% |
| 좌표 보유율 | 17% | 17% | **60~80%** |
| 건축지표 보유율 | 0% | **40~60%** | 40~60% |
| 시공사 보유율 | 6% | **15~25%** | 15~25% |
| SEO 랜딩 페이지 | 0 | 0 | **18+** |
| 카드 정보 밀도 | 4항목 | 4항목 | **8~10항목** |
| 구역 내 실거래 | 없음 | 없음 | **연동 완료** |
| 블로그 연결 | 없음 | 없음 | **348편 연결** |

---

## 부록: 경쟁사 대비 포지셔닝

| 기능 | 줍줍맵 | 재모 | 재개발닷컴 | **카더라** (구현 후) |
|------|-------|------|----------|-----------------|
| 지도 검색 | ✅ 핵심 | ✅ | ✅ | ⬜ (좌표 확보 후) |
| 구역 실거래 | ❌ | ❌ | ✅ 핵심 | **✅ apt_transactions 연동** |
| 조합원 커뮤니티 | ❌ | ✅ 핵심 | ❌ | ⬜ (discuss 확장 가능) |
| AI 분석 | ❌ | ❌ | ✅ 감정순위 | **✅ Claude AI 요약** |
| 분양 비교 | ❌ | ❌ | ❌ | **✅ 유일** (분양+재개발 통합) |
| 알림 (카카오/푸시) | ❌ | ❌ | 매물알림 | **✅ 3채널 알림** |
| 블로그 콘텐츠 | ❌ | 뉴스모음 | ❌ | **✅ 348편 + 자동생성** |
| 세금 계산기 | ❌ | ❌ | ❌ | **✅ 기존 calc 활용** |

**카더라의 차별점**: 재개발을 "부동산 투자의 한 옵션"으로 통합. 분양 vs 재개발 vs 미분양 비교가 가능한 유일한 플랫폼.
