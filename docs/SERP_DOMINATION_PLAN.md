# 카더라 검색 결과 노출면적 극대화 전략
> 작성일: 2026-04-06 | 목표: 1개 키워드 검색 시 1페이지 5~7개 URL 점유

---

## 현재 노출 구조 (3개 URL)

```
"삼성전자 주가" 검색 시:
  ① /stock/005930 (메인 페이지)
  ② /blog/삼성전자-투자-전략 (클러스터 블로그)
  ③ /blog/삼성전자-배당금-분석 (클러스터 블로그)
```

## 목표 노출 구조 (7개 URL + 리치 피처 4종)

```
"삼성전자 주가" 검색 시:
  ① [AI Overview 인용] — 구글 AI가 카더라 데이터 인용
  ② [이미지 캐러셀] — 차트/인포그래픽 3~4장 노출
  ③ /stock/005930 (메인 + FAQ 리치스니펫 + 별점 + 사이트링크)
  ④ /blog/삼성전자-투자-전략 (클러스터)
  ⑤ /blog/삼성전자-배당금-분석 (클러스터)
  ⑥ /calc/삼성전자-수익률-계산기 (도구 페이지)  ← NEW
  ⑦ /stock/005930/compare (비교 페이지)  ← NEW
  ⑧ [People Also Ask] — FAQ 5개 중 2~3개 노출
  ⑨ [비디오 캐러셀] — 자동 생성 차트 영상  ← 장기
```

---

## 전략 1: 이미지 캐러셀 점령 (즉시 효과)

### 왜?
- 구글 모바일 검색의 20%에 이미지 팩 노출
- 2024→2026 이미지 팩 출현 48.5% 증가 (seoClarity 데이터)
- 이미지 1장 = 검색 결과 1줄 추가 점유

### 구현 방법

**A. 종목별 인포그래픽 자동 생성 (OG 이미지 확장)**

현재 `/api/og`는 제목+브랜드 OG 이미지만 생성.
→ 종목/현장별 **데이터 인포그래픽 이미지** 추가 생성:

```
/api/og-chart?symbol=005930 → 주가 차트 이미지 (1200x630)
/api/og-infographic?symbol=005930 → PER/PBR/배당 카드 이미지 (1200x630)
/api/og-compare?symbol=005930 → 경쟁사 비교 이미지 (1200x630)

/api/og-chart?apt=한화포레나-부산당리 → 분양가 범위 차트 (1200x630)
/api/og-infographic?apt=한화포레나-부산당리 → 입지분석 요약 카드 (1200x630)
/api/og-floorplan?apt=한화포레나-부산당리 → 평면도 요약 (1200x630)
```

**B. 이미지 SEO 최적화**

```html
<!-- 모든 인포그래픽에 상세 alt 텍스트 -->
<img src="/api/og-chart?symbol=005930"
     alt="삼성전자 2026년 주가 차트 - 현재가 193,100원 전년 대비 251% 상승"
     width="1200" height="630" />

<!-- 이미지 구조화 데이터 -->
<script type="application/ld+json">
{
  "@type": "ImageObject",
  "contentUrl": "https://kadeora.app/api/og-chart?symbol=005930",
  "name": "삼성전자 주가 차트 2026",
  "description": "삼성전자(005930) 실시간 주가 차트. 현재가 193,100원.",
  "width": 1200, "height": 630
}
</script>
```

**C. 이미지 사이트맵 강화**

현재: OG 이미지 2종 (1200x630, 630x630)
→ 종목/현장당 **4~6종 이미지** 등록:

```xml
<url>
  <loc>https://kadeora.app/stock/005930</loc>
  <image:image>
    <image:loc>https://kadeora.app/api/og-chart?symbol=005930</image:loc>
    <image:title>삼성전자 주가 차트 2026</image:title>
  </image:image>
  <image:image>
    <image:loc>https://kadeora.app/api/og-infographic?symbol=005930</image:loc>
    <image:title>삼성전자 PER PBR 투자 지표</image:title>
  </image:image>
  <image:image>
    <image:loc>https://kadeora.app/api/og-compare?symbol=005930</image:loc>
    <image:title>삼성전자 vs SK하이닉스 비교</image:title>
  </image:image>
</url>
```

---

## 전략 2: 구조화 데이터 풀스택 (리치 피처 극대화)

### 현재 구현된 구조화 데이터
- ✅ FAQPage (FAQ 5개)
- ✅ ApartmentComplex + RealEstateListing
- ✅ AggregateRating (별점)
- ✅ BreadcrumbList
- ✅ Organization

### 추가 필요한 구조화 데이터

**A. FinancialProduct 스키마 (주식 페이지)**

```json
{
  "@type": "FinancialProduct",
  "name": "삼성전자 주식",
  "category": "Stock",
  "offers": {
    "@type": "Offer",
    "price": "193100",
    "priceCurrency": "KRW",
    "availability": "InStock"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "ratingCount": "1247"
  }
}
```

**B. HowTo 스키마 (청약 가이드 / 투자 가이드)**

```json
{
  "@type": "HowTo",
  "name": "한화포레나 부산당리 청약 신청 방법",
  "step": [
    { "@type": "HowToStep", "name": "청약 자격 확인", "text": "무주택 세대 구성원 여부 확인" },
    { "@type": "HowToStep", "name": "청약통장 확인", "text": "가입 기간 24개월 이상, 지역별 예치금 확인" },
    { "@type": "HowToStep", "name": "청약홈 접수", "text": "applyhome.co.kr에서 온라인 접수" }
  ]
}
```

**C. WebApplication 스키마 (계산기 도구)**

```json
{
  "@type": "WebApplication",
  "name": "삼성전자 투자 수익률 계산기",
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "KRW" }
}
```

**D. VideoObject 스키마 (향후 비디오 추가 시)**

```json
{
  "@type": "VideoObject",
  "name": "삼성전자 2026년 투자 분석 요약",
  "thumbnailUrl": "https://kadeora.app/api/og-chart?symbol=005930",
  "uploadDate": "2026-04-06",
  "duration": "PT2M30S",
  "description": "삼성전자 AI 종합 분석 2분 요약"
}
```

---

## 전략 3: 페이지 다각화 (URL 슬롯 증가)

### 현재: 종목당 2~3 URL
- /stock/{symbol} (메인)
- /blog/{종목}-투자-전략 (클러스터 1)
- /blog/{종목}-배당금-분석 (클러스터 2)

### 목표: 종목당 5~7 URL

**A. 도구 페이지 (계산기)**

```
/calc?stock=005930         → 삼성전자 투자 수익률 계산기
/calc?stock=005930&type=dividend → 삼성전자 배당 재투자 시뮬레이터
/calc?apt=한화포레나-부산당리    → 한화포레나 부산당리 실입주 비용 계산기
```

- 각 도구 페이지에 고유 title + description
- "삼성전자 수익률 계산기"로 검색 시 노출
- 도구 페이지는 체류시간이 길어서 SEO 점수 ↑

**B. 비교 페이지**

```
/stock/005930/vs/000660    → 삼성전자 vs SK하이닉스 비교 분석
/apt/한화포레나-부산당리/vs/래미안   → 한화포레나 vs 래미안 비교
```

- "삼성전자 SK하이닉스 비교" 검색 시 독점
- X vs Y 검색어는 경쟁이 적고 전환율 높음

**C. 현장/종목별 타임라인 페이지**

```
/stock/005930/history      → 삼성전자 주가 히스토리 타임라인
/apt/한화포레나-부산당리/timeline → 한화포레나 부산당리 청약~입주 타임라인
```

**D. 지역 허브 페이지 (부동산)**

```
/apt/region/부산-사하구     → 부산 사하구 전체 분양/시세 허브
/apt/region/경기-화성시     → 화성시 전체 분양/시세 허브
```

- "부산 사하구 분양" 검색 시 지역 허브가 별도 노출
- 개별 현장 페이지와 중복 아님 (지역 총괄 vs 개별)

---

## 전략 4: 네이버 전용 최적화

### 네이버 검색 구조

```
네이버 검색 결과 영역:
  ① 파워링크 (유료광고) — 스킵
  ② VIEW (블로그/카페) — 카더라 블로그 노출 가능
  ③ 웹사이트 — 메인 페이지 노출
  ④ 이미지 — 이미지 캐러셀
  ⑤ 지식iN — FAQ 노출
  ⑥ 뉴스 — 향후
```

### 네이버 VIEW 탭 점유 전략

카더라 블로그를 네이버 VIEW 영역에 노출시키려면:
- `naver:written_time` 메타태그 (✅ 이미 구현)
- `og:article:published_time` 정확한 날짜 (✅ 이미 구현)
- **신디케이션 API 연동** — 네이버에 콘텐츠 직접 전송
- **RSS 피드 제출** — 네이버 서치어드바이저에서 RSS 등록

### 네이버 이미지 탭 점유

- 각 페이지에 **고유 이미지 6장 이상** (네이버 블로그 노출 기준)
- 이미지 파일명에 키워드 포함: `삼성전자-주가-차트-2026.webp`
- `<img>` 태그에 `title` 속성 추가

---

## 전략 5: AI Overview / AI 답변 인용 확보

### 2026년 구글 검색의 30%+ 에 AI Overview 노출

AI가 카더라를 인용하려면:
- **E-E-A-T 강화**: 전문성, 경험, 권위, 신뢰
- **명확한 구조**: 질문→답변 패턴 (FAQ, HowTo)
- **데이터 기반 콘텐츠**: 구체적 숫자, 표, 차트
- **Schema 마크업**: AI가 구조화 데이터를 우선 인용

### 구현 방법

```
현재 분석 텍스트:
  "삼성전자는 대한민국을 대표하는 기업으로..."
  → AI가 인용하기 어려운 서술형

개선:
  "삼성전자(005930) 핵심 투자 지표:
   - 현재가: 193,100원 (+3.71%)
   - PER: 9.2배 (업종 평균 15.3배 대비 저평가)
   - 시가총액: 1,044조원 (코스피 1위)
   - 배당수익률: 1.8%
   - 52주 범위: 52,900원 ~ 223,000원"
  → AI가 정확한 데이터를 인용하기 쉬운 구조
```

---

## 전략 6: People Also Ask (PAA) 점령

### PAA = 검색 결과 중간에 노출되는 관련 질문 박스

하나의 키워드로 PAA 3~5개를 동시에 점유하면 노출면적 극대화.

### 구현: 블로그 클러스터를 PAA 질문에 맞춤

```
키워드: "삼성전자 주가"

PAA 예상 질문:
  Q. 삼성전자 주가 전망 2026년은?
  Q. 삼성전자 PER은 얼마인가요?
  Q. 삼성전자 배당금을 주나요?
  Q. 삼성전자 목표가는?
  Q. 삼성전자 실적 발표일은?

각 질문에 대한 전용 블로그 → 클러스터 확장 (3편 → 5편):
  기존: 투자전략, 배당분석, 실적전망
  추가: 목표가분석, PER밸류에이션
```

---

## 실행 로드맵

### Phase 1: 이미지 캐러셀 (1~2세션, 즉시 효과)

| # | 작업 | 효과 |
|---|------|------|
| 1-1 | `/api/og-chart` 엔드포인트 — 종목별 주가 차트 이미지 자동 생성 | 이미지 팩 진입 |
| 1-2 | `/api/og-infographic` — 종목/현장별 핵심 지표 인포그래픽 | 이미지 다양성 ↑ |
| 1-3 | 이미지 사이트맵 종목/현장당 4~6장으로 확장 | 이미지 인덱싱 ↑ |
| 1-4 | 모든 이미지에 키워드 포함 alt/title 속성 | 이미지 SEO ↑ |

### Phase 2: 구조화 데이터 확장 (1세션)

| # | 작업 | 효과 |
|---|------|------|
| 2-1 | HowTo 스키마 — 청약 신청 가이드, 투자 가이드 | HowTo 리치스니펫 |
| 2-2 | FinancialProduct 스키마 — 주식 가격 노출 | 가격 리치스니펫 |
| 2-3 | WebApplication 스키마 — 계산기 도구 | 도구 리치스니펫 |
| 2-4 | Offer 스키마 — 분양가 범위 노출 | 가격 정보 노출 |

### Phase 3: URL 슬롯 증가 (2~3세션)

| # | 작업 | 효과 |
|---|------|------|
| 3-1 | 종목/현장 비교 페이지 자동 생성 (/stock/A/vs/B) | X vs Y 검색어 독점 |
| 3-2 | 계산기 도구 전용 페이지 (종목/현장별 파라미터) | 도구 검색어 독점 |
| 3-3 | 지역 허브 페이지 (/apt/region/부산-사하구) | 지역 검색어 독점 |
| 3-4 | 블로그 클러스터 3편 → 5편 확장 (PAA 타겟) | PAA 점유 ↑ |

### Phase 4: 네이버 전용 (1세션)

| # | 작업 | 효과 |
|---|------|------|
| 4-1 | RSS 피드 생성 + 네이버 서치어드바이저 등록 | VIEW 탭 노출 |
| 4-2 | 네이버 신디케이션 API 연동 | 실시간 콘텐츠 전송 |
| 4-3 | 페이지당 이미지 6장+ 확보 | 네이버 이미지 탭 |

### Phase 5: AI Overview 인용 (지속)

| # | 작업 | 효과 |
|---|------|------|
| 5-1 | 분석 텍스트 → 데이터 테이블 + 핵심 수치 구조 | AI 인용 확률 ↑ |
| 5-2 | Wikidata 등록 (카더라 엔티티) | 지식 패널 진입 |
| 5-3 | 업계 리포트 인용 + 출처 명시 | E-E-A-T 신뢰도 ↑ |

---

## 예상 결과: 1페이지 점유율

```
Before (현재):           After (3개월 후):
─────────────          ─────────────
메인 페이지 1개          AI Overview 인용
클러스터 2개             이미지 캐러셀 3~4장
                        메인 페이지 + FAQ + 별점 + 사이트링크
                        클러스터 블로그 3~5편
                        비교 페이지 1개
                        계산기 도구 1개
                        PAA 2~3개 점유
─────────────          ─────────────
총 3개 URL              총 5~7개 URL + 리치 피처 4종
1페이지 점유율 ~15%      1페이지 점유율 ~50%+
```
