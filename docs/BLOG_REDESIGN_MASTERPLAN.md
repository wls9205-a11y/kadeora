# 카더라 블로그 전면 재설계 마스터플랜 v1.0

> **작성일:** 2026-04-12
> **목표:** 각 블로그 하위페이지가 해당 키워드 포털사이트 1위를 달성할 수 있는 완성형 콘텐츠 시스템 구축
> **범위:** 기존 7,605건 재구축 + 신규 콘텐츠 자동발행 파이프라인 + 블로그 UI/UX 전면 개선

---

## 1. 현황 진단 요약

### 1.1 품질 등급별 현황 (2026-04-12 기준)

| 등급 | 건수 | 평균 조회수 | 평균 글자수 | 핵심 문제 |
|------|------|-----------|-----------|----------|
| A등급 (고품질) | 940 | 170 | 4,947 | 목차 없음, 순수 마크다운 — **유지** |
| B등급 (부분 리라이트) | 2,892 | 99 | 2,397 | 너무 짧음, 데이터 부족 — **재리라이트** |
| C등급 (템플릿 원본) | 3,726 | 17 | 6,844 (HTML 포함) | 인라인 HTML, 영어 raw값, 보일러플레이트 — **전면 재작성** |
| D등급 (기타) | 47 | 89 | 3,145 | 중간 상태 — **재리라이트** |

### 1.2 주입 가능한 실데이터 인벤토리

| DB 테이블 | 건수 | 주입 대상 카테고리 |
|----------|------|------------------|
| apt_complex_profiles (단지 프로필) | 34,537 | apt, unsold |
| apt_transactions (실거래) | 497,413 | apt |
| stock_quotes (종목 시세) | 1,846 | stock |
| stock_price_history (주가 이력) | 41,996 | stock |
| redevelopment_projects (재개발) | 217 | apt |
| unsold_apts (미분양) | 204 | unsold |
| landmark_apts (랜드마크) | 120 | apt |
| blog_post_images (Unsplash 이미지) | 22,809 | 전체 |

**핵심 포인트:** apt_complex_profiles에 `built_year`, `total_households`, `latest_sale_price`, `avg_sale_price_pyeong`, `jeonse_ratio`, `price_change_1y` 등 포털 1위에 필요한 핵심 데이터가 이미 존재하지만 현재 블로그 콘텐츠에 전혀 주입되지 않고 있음.

### 1.3 포털 1위 콘텐츠와의 갭 분석

#### 카더라 C등급 글 (장락주공2단지)
```
"장락주공2단지은 충북 소재 아파트입니다. 2026년 부동산 시장 회복과 함께..."
- 위치: "충북" (시/군/구/동 없음)
- 세대수: "확인 필요세대"
- 실거래가: 없음
- 유형: "trade" (영어)
```

#### 포털 1위 (부동산뱅크)
```
"제천시 장락동 장락주공2단지 — 1999년 5월 입주, 714가구, 신일건업 시공
9개 동 지상 15층, 개별난방, 주차 0.73대/가구(518대)
3.3㎡당 매매가 492만원, 장락동 13개 단지 중 5위
1년간 3.14% 상승 (477만→492만원), 67㎡ 5.26% 상승"
```

**결론:** 데이터가 DB에 있는데도 프롬프트에 주입하지 않아 빈 콘텐츠가 생성되고 있음.

---

## 2. 포털 1위를 위한 콘텐츠 설계 원칙

### 2.1 구글 E-E-A-T 기준 충족

| E-E-A-T 요소 | 현재 | 목표 |
|-------------|------|------|
| Experience (경험) | 자동생성 표기만 | 실데이터 기반 분석, 차트/인포그래픽 |
| Expertise (전문성) | 보일러플레이트 | 카테고리별 전문 용어, 비교 분석, FAQ |
| Authoritativeness (권위) | 없음 | 공공데이터 출처 명시, 내부 데이터 교차 검증 |
| Trustworthiness (신뢰) | 가짜 데이터 존재 | 실거래가 기반, 데이터 기준일 명시 |

### 2.2 네이버 SEO 기준 충족

| 네이버 기준 | 현재 | 목표 |
|-----------|------|------|
| C-Rank (사이트 신뢰도) | 저품질 대량 콘텐츠로 하락 | 고품질 소량으로 전환 |
| D.I.A (사용자 반응) | 체류시간 극히 짧음 | 인터랙티브 요소 + 내부 링크로 체류 증가 |
| 문서 길이 | 혼재 (2,000~7,000) | 최소 5,000자 순수 텍스트 |
| 이미지 | OG 텍스트카드만 | Unsplash 실사진 + 인포그래픽 + 차트 |

### 2.3 포털 노출면적 최대화 전략

#### JSON-LD 구조화 데이터 (이미 구현됨, 강화 필요)
- `Article` → `NewsArticle`로 변경 (속보 카르셀 진입)
- `FAQPage` → 각 글에 3~5개 FAQ 필수 (SERP FAQ 노출)
- `HowTo` → 계산기/가이드 글에 적용 (단계별 노출)
- `Table` → 실거래가 표에 적용 (표 스니펫 노출)
- `BreadcrumbList` → 이미 구현됨

#### 메타 태그 최적화
- `title`: 50자 이내, 핵심 키워드 앞배치 + 브랜드
- `description`: 120~155자, 핵심 수치 포함 (예: "714세대, 3.3㎡당 492만원")
- `naver:description`: 네이버 전용 디스크립션 (이미 구현됨)
- `article:tag`: 관련 키워드 5~8개
- `og:image`: Unsplash 실사진 1200x630

---

## 3. 카테고리별 완성형 콘텐츠 템플릿

### 3.1 apt (부동산) 카테고리 — 단지 분석 글

#### 프롬프트에 주입할 실데이터 (apt_complex_profiles + apt_transactions JOIN)
```
단지명: {apt_name}
위치: {region_nm} {sigungu} {dong}
입주년도: {built_year}년 (연식 {current_year - built_year}년차)
총 세대수: {total_households}세대
최근 매매가: {latest_sale_price}만원 ({latest_sale_date} 기준)
평당가: {avg_sale_price_pyeong}만원/3.3㎡
최근 전세가: {latest_jeonse_price}만원
전세가율: {jeonse_ratio}%
1년 가격변동: {price_change_1y}%
1년 매매 거래건수: {sale_count_1y}건
1년 임대 거래건수: {rent_count_1y}건
```

#### 최근 실거래 3건 (apt_transactions에서 추출)
```
1. {거래일} | {전용면적}㎡ | {층}층 | {거래금액}만원
2. {거래일} | {전용면적}㎡ | {층}층 | {거래금액}만원
3. {거래일} | {전용면적}㎡ | {층}층 | {거래금액}만원
```

#### 주변 비교 단지 (같은 동/구 내 apt_complex_profiles)
```
같은 {dong} 내 비교:
- {비교단지1}: 평당가 {N}만원, {year}년 입주, {households}세대
- {비교단지2}: 평당가 {N}만원, {year}년 입주, {households}세대
```

#### 목표 글 구조 (5,000자+ 순수 텍스트)
```markdown
## {단지명}, 지금 투자해도 될까? — {dong} 실거래 데이터로 본 객관적 분석

[도입: 해당 단지의 최근 거래 동향을 1~2문장으로 요약. 핵심 수치 포함.]

## 단지 기본 정보

| 항목 | 상세 |
|------|------|
| 위치 | {region_nm} {sigungu} {dong} |
| 입주 | {built_year}년 ({age}년차) |
| 세대수 | {total_households}세대 |
| 시공사 | {builder} |

## 최근 실거래가 분석

[최근 3건 실거래 데이터 표 + 1년 추이 해석]

| 거래일 | 면적 | 층 | 거래가 | 평당가 |
|--------|------|-----|--------|--------|
| ... | ... | ... | ... | ... |

[1년간 {price_change_1y}% 변동에 대한 맥락 분석]

## 주변 시세 비교

[같은 동/구 내 비교 단지 3곳과의 평당가, 연식, 세대수 비교표]

## 전세가율 & 투자 지표

- 전세가율: {jeonse_ratio}% → [갭투자 매력도 분석]
- 1년 거래량: 매매 {sale_count_1y}건, 임대 {rent_count_1y}건 → [유동성 분석]

## 입지 분석 — 교통·학군·생활인프라

[카카오맵/네이버지도 API 없이, DB에서 가져온 위치 기반 텍스트 분석]

## 투자 시 체크리스트

1. 연식 {age}년차 → 재건축/리모델링 가능성
2. 세대수 {total_households} → 대단지 프리미엄 여부
3. 전세가율 {jeonse_ratio}% → 갭투자 레버리지
4. 최근 거래량 → 유동성 확보 가능 여부

## ❓ 자주 묻는 질문

### {단지명} 현재 매매 시세는?
{전용면적}㎡ 기준 약 {latest_sale_price}만원 수준입니다 ({latest_sale_date} 최근 거래 기준).

### {단지명}이 속한 {dong}의 평균 시세는?
{dong} 평균 평당가는 약 {area_avg}만원이며, {단지명}은 이보다 {diff}% {높/낮}은 수준입니다.

### 전세가율 {jeonse_ratio}%는 높은 편인가요?
[전세가율 해석 가이드]

## 🔗 관련 정보

- [{단지명} 실시간 시세 →](/apt/sites/{slug})
- [같은 지역 청약 일정 →](/apt)
- [{dong} 미분양 현황 →](/apt?tab=unsold)
- [부동산 취득세 계산 →](/calc/real-estate/acquisition-tax)
- [카더라 부동산 블로그 →](/blog?category=apt)

> 이 분석은 국토교통부 실거래가 공개시스템, 카더라 자체 수집 데이터 기준입니다.
> 데이터 기준일: {data_date} | 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.
```

### 3.2 stock (주식) 카테고리 — 종목 분석 글

#### 프롬프트에 주입할 실데이터 (stock_quotes + stock_price_history)
```
종목명: {name}
종목코드: {symbol}
시장: {market} (KOSPI/KOSDAQ/NYSE/NASDAQ)
현재가: {price}{currency}
등락률: {change_pct}%
52주 최고가: {high_52w}
52주 최저가: {low_52w}
시가총액: {market_cap}
PER: {per}
PBR: {pbr}
배당수익률: {dividend_yield}% (실제 데이터, 없으면 "미배당" 명시)
최근 5일 가격: [{5일치 종가 배열}]
```

#### 목표 글 구조 (6,000자+)
```markdown
## {종목명}({symbol}), {오늘 날짜} 기준 투자 분석 — 현재가 {price}원

[도입: 최근 주가 흐름 1~2문장 요약]

## 기업 개요 & 핵심 지표

| 지표 | 수치 |
|------|------|
| 현재가 | {price}{currency} ({change_pct}%) |
| 시가총액 | {market_cap} |
| PER / PBR | {per} / {pbr} |
| 52주 범위 | {low_52w} — {high_52w} |
| 배당수익률 | {dividend_yield}% |

## 최근 주가 흐름

[5일/20일/60일 이동평균 기준 추세 분석]

## 동종업계 비교

[같은 섹터 3~5개 종목과의 PER/PBR/시총 비교표]

## 투자 포인트 & 리스크

### 긍정 요인
- [실제 재무 데이터 기반 분석]

### 리스크
- [업종 리스크, 밸류에이션 리스크 등]

## ❓ 자주 묻는 질문

### {종목명} 지금 매수해도 될까?
[현재 밸류에이션 기준 중립적 분석]

### 배당은 언제 받을 수 있나?
[실제 배당 데이터 기반, 미배당이면 명확히 "미배당 종목" 표기]

## 🔗 관련 정보
- [{종목명} 실시간 차트 →](/stock/{symbol})
- [같은 업종 비교 →](/stock/compare?symbols={symbol},{comp1},{comp2})
- [종합 시세 →](/stock)
- [투자 커뮤니티 →](/feed?category=stock)
```

### 3.3 unsold (미분양) 카테고리

#### 프롬프트에 주입할 실데이터 (unsold_apts)
```
단지명: {name}
위치: {region} {sigungu}
총 세대수: {total_units}
미분양 세대수: {unsold_units}
미분양률: {unsold_ratio}%
분양가: {price_range}
준공 여부: {is_completed} (준공후 미분양이면 별도 표기)
```

### 3.4 finance (재테크) 카테고리

재테크 글은 DB 데이터 주입보다 **정확한 제도 정보 + 계산 예시**가 핵심.
- 세금 계산 시나리오 3개 이상
- 비교표 (은행별/증권사별)
- 단계별 신청 가이드

---

## 4. 이미지 전략

### 4.1 Unsplash 통합 (현재 → 개선)

#### 현재 상태
- `blog-generate-images` 크론: 매일 100건 배치
- 카테고리별 키워드로 Unsplash API 호출
- `blog_post_images` 테이블에 저장 (22,809건)
- `BlogHeroImage` 컴포넌트: 캐러셀 렌더링

#### 개선 방향
1. **키워드 정밀화**: 현재 "Korean apartment building" 같은 일반 키워드 → 단지/지역 특성 반영 키워드
   - apt: "luxury apartment Korea", "apartment complex aerial view", "modern residential building Seoul"
   - stock: "stock market trading screen", "financial chart analysis", "Korean stock exchange"
   - unsold: "empty apartment building", "new construction apartment", "apartment for sale"
2. **인포그래픽 자동 생성**: `/api/og-infographic` 엔드포인트로 데이터 카드 이미지 자동 생성
3. **이미지 품질 필터**: Unsplash API에서 `likes > 50`, `width > 2000` 필터 추가
4. **Attribution 자동 삽입**: "Photo by {name} on Unsplash" 캡션 (현재 구현됨)

### 4.2 OG 이미지 전략

| 용도 | 크기 | 생성 방식 |
|------|------|----------|
| SNS 공유용 | 1200×630 | `/api/og?title=...&category=...&design=2` |
| 네이버 모바일 | 630×630 | `/api/og-square` |
| 본문 인포그래픽 | 1200×630 | `/api/og-infographic` (신규) |
| Unsplash 히어로 | 원본 비율 | blog_post_images 테이블 |

---

## 5. 내부 링크 전략

### 5.1 현재 문제점
- 내부 링크 0개인 글: 47건
- 대부분 `/stock`, `/apt`, `/blog`, `/feed` 같은 최상위 페이지로만 링크
- **실제 관련 콘텐츠로의 심층 링크가 없음**

### 5.2 개선: 컨텍스트 기반 자동 내부 링크

#### apt 카테고리 글에서의 내부 링크
```
1. [같은 지역 다른 단지 분석] → /apt/sites/{nearby_slug_1}
2. [해당 구/군 실거래 동향] → /blog/{region_trade_trend_slug}
3. [청약 가점 계산기] → /apt/diagnose
4. [해당 지역 미분양 현황] → /apt?tab=unsold&region={region}
5. [부동산 취득세 계산기] → /calc/real-estate/acquisition-tax
6. [전세가율 지도] → /apt?tab=transaction
7. [관련 재개발 프로젝트] → /blog/{redev_slug} (있는 경우)
```

#### stock 카테고리 글에서의 내부 링크
```
1. [종목 실시간 차트] → /stock/{symbol}
2. [동종업계 비교] → /stock/compare?symbols={symbol},{comp1},{comp2}
3. [관련 ETF 분석] → /blog/{etf_compare_slug}
4. [해당 섹터 테마주] → /stock?theme={theme}
5. [투자 커뮤니티 토론] → /feed?category=stock
```

### 5.3 자동 내부 링크 생성 시스템 설계

블로그 글 생성/리라이트 시 프롬프트에 관련 내부 링크 목록을 자동으로 주입하는 함수:

```typescript
async function getContextualLinks(category: string, metadata: any): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const links: string[] = [];
  
  if (category === 'apt') {
    // 같은 지역 다른 단지 SEO 페이지
    const { data: nearbyApts } = await admin.from('apt_sites')
      .select('slug, name')
      .eq('sigungu', metadata.sigungu)
      .neq('slug', metadata.slug)
      .limit(3);
    if (nearbyApts) {
      nearbyApts.forEach(a => links.push(`[${a.name} 분석 →](/apt/sites/${a.slug})`));
    }
    
    // 같은 지역 관련 블로그 글
    const { data: relatedBlogs } = await admin.from('blog_posts')
      .select('slug, title')
      .eq('is_published', true)
      .eq('category', 'apt')
      .ilike('title', `%${metadata.sigungu}%`)
      .neq('slug', metadata.currentSlug)
      .order('view_count', { ascending: false })
      .limit(2);
    if (relatedBlogs) {
      relatedBlogs.forEach(b => links.push(`[${b.title.slice(0, 30)} →](/blog/${b.slug})`));
    }
    
    // 고정 도구 링크
    links.push('[청약 가점 계산 →](/apt/diagnose)');
    links.push('[취득세 계산기 →](/calc/real-estate/acquisition-tax)');
    links.push('[전체 청약 일정 →](/apt)');
  }
  
  if (category === 'stock') {
    links.push(`[${metadata.name} 실시간 차트 →](/stock/${metadata.symbol})`);
    // 같은 섹터 종목 비교 링크
    links.push('[종합 시세 →](/stock)');
    links.push('[종목 비교 →](/stock/compare)');
  }
  
  links.push('[커뮤니티 토론 →](/feed)');
  links.push('[카더라 블로그 →](/blog)');
  
  return links;
}
```

---

## 6. 블로그 UI/UX 개선 설계

### 6.1 블로그 상세 페이지 레이아웃 개선

#### 현재 문제
- 본문만 있는 1컬럼 레이아웃
- 목차(TOC)가 모바일에서만 인라인
- 관련 글이 하단에만 존재 (스크롤 필요)
- 사이드바 없음

#### 개선 설계 (데스크탑 2컬럼, 모바일 1컬럼)

```
┌──────────────────────────────────────────────┐
│ [breadcrumb: 블로그 > 부동산 > 단지분석]       │
├────────────────────────┬─────────────────────┤
│ [히어로 이미지 캐러셀]  │                     │
│                        │  ┌─────────────────┐│
│ [저자정보 + 날짜]       │  │ 📌 목차 (sticky) ││
│                        │  │ 1. 단지 개요     ││
│ [태그 칩]              │  │ 2. 실거래가      ││
│                        │  │ 3. 주변 비교     ││
│ [공유 바]              │  │ 4. 투자 체크     ││
│                        │  │ 5. FAQ          ││
│ ── 본문 시작 ──        │  └─────────────────┘│
│                        │                     │
│ ## 단지 기본 정보       │  ┌─────────────────┐│
│ [핵심 지표 카드 그리드]  │  │ 📊 핵심 지표     ││
│                        │  │ 평당가: 492만원  ││
│ ## 실거래가 분석        │  │ 전세가율: 72%   ││
│ [실거래 표]             │  │ 1년 변동: +3.1% ││
│ [추이 차트]             │  └─────────────────┘│
│                        │                     │
│ ## 주변 시세 비교       │  ┌─────────────────┐│
│ [비교표]               │  │ 🔗 관련 단지     ││
│                        │  │ • A단지 →       ││
│ ## FAQ                 │  │ • B단지 →       ││
│ [아코디언]             │  │ • C단지 →       ││
│                        │  └─────────────────┘│
│ ## 관련 정보            │                     │
│ [내부 링크 카드 그리드]  │  ┌─────────────────┐│
│                        │  │ 🏢 도구          ││
│ [도움이됐어요 버튼]     │  │ 청약 가점 계산→  ││
│                        │  │ 취득세 계산→     ││
│ ── 댓글 섹션 ──        │  │ 중개수수료→      ││
│                        │  └─────────────────┘│
├────────────────────────┴─────────────────────┤
│ [관련 글 추천 카드 3장]                        │
│ [이전글 / 다음글 네비게이션]                    │
└──────────────────────────────────────────────┘
```

### 6.2 본문 디자인 개선

#### 6.2.1 핵심 지표 카드 (본문 최상단)
```html
<div class="blog-metric-cards">
  <div class="metric-card">
    <span class="label">평당가</span>
    <span class="value">492만원</span>
    <span class="change positive">+3.1%</span>
  </div>
  <div class="metric-card">
    <span class="label">전세가율</span>
    <span class="value">72.3%</span>
  </div>
  <div class="metric-card">
    <span class="label">세대수</span>
    <span class="value">714세대</span>
  </div>
  <div class="metric-card">
    <span class="label">연식</span>
    <span class="value">26년차</span>
  </div>
</div>
```

#### 6.2.2 테이블 스타일 표준화
- 인라인 HTML 스타일 전면 제거 → 마크다운 테이블만 사용
- `blog-content table` CSS 클래스로 통일
- 다크모드 자동 적응
- 모바일 가로 스크롤 지원

#### 6.2.3 인용문/강조 블록
```markdown
> 💡 **핵심 포인트**: 장락주공2단지의 전세가율 72%는 제천시 평균 68%보다 높아
> 갭투자 매력도가 상대적으로 낮습니다. 실거주 목적이라면 전세 → 매수 전환 전략이 유효합니다.
```

#### 6.2.4 가독성 개선
- 본문 `font-size`: 16px → 17px
- `line-height`: 1.75 → 1.85
- 문단 간격: 기존 유지
- 소제목(h2) 상단에 구분선 + 여백 추가
- 핵심 수치 자동 하이라이트 (파란색 강조)

---

## 7. 기존 콘텐츠 재구축 실행 계획

### Phase 0: 즉시 DB 일괄 수정 (30분)

```sql
-- 1. 영어 raw 값 한글 치환
UPDATE blog_posts SET content = REPLACE(content, '>trade<', '>실거래<') WHERE content LIKE '%>trade<%';
UPDATE blog_posts SET content = REPLACE(content, '>subscription<', '>청약<') WHERE content LIKE '%>subscription<%';
UPDATE blog_posts SET content = REPLACE(content, '>active<', '>분양중<') WHERE content LIKE '%>active<%';
UPDATE blog_posts SET content = REPLACE(content, '>closed<', '>마감<') WHERE content LIKE '%>closed<%';

-- 2. "약 약" 오타 수정
UPDATE blog_posts SET content = REPLACE(content, '약 약 ', '약 ') WHERE content LIKE '%약 약 %';

-- 3. "확인 필요세대" 제거
UPDATE blog_posts SET content = REPLACE(content, '확인 필요세대', '-') WHERE content LIKE '%확인 필요세대%';
```

### Phase 1: C등급 3,726건 전면 재작성 (2~3주)

**전략:** 기존 콘텐츠를 버리고, DB 실데이터 기반으로 새로 생성

1. 카테고리별로 blog_posts와 실데이터 테이블을 JOIN
2. 실데이터를 프롬프트에 주입
3. Batch API로 하루 500건씩 재생성
4. rewritten_at 갱신 + 인라인 HTML 포함 여부 체크

**새 크론: `blog-enrich-rewrite`**
```
1. blog_posts에서 C등급 (인라인 HTML 포함) 글 500건 추출
2. 각 글의 카테고리에 따라 실데이터 JOIN
3. 새 프롬프트 (실데이터 주입 + 구조 강제) 로 Batch API 호출
4. 결과물에서 인라인 HTML 제거 확인 후 UPDATE
```

### Phase 2: B등급 2,892건 보강 (1~2주)

**전략:** 기존 콘텐츠 유지하되, 실데이터 섹션 추가

1. 글 하단에 "## 최신 데이터 업데이트" 섹션 자동 삽입
2. 실거래가 표, 비교 단지, 핵심 지표 카드 데이터 삽입
3. 글 길이 2,397자 → 4,000자+ 목표

### Phase 3: 신규 콘텐츠 파이프라인 전환 (1주)

기존 크론 프롬프트 전면 교체:
- 모든 blog-* 크론에서 **실데이터 주입 함수** 호출
- 출력 규칙 강제: "순수 마크다운만, 인라인 HTML 금지, 최소 5,000자"
- 품질 게이트: 생성 후 길이/패턴 체크 → 부적격이면 재생성

---

## 8. 품질 게이트 시스템

### 8.1 발행 전 자동 검증 (blog quality gate)

```typescript
interface QualityCheck {
  pass: boolean;
  score: number;    // 0~100
  issues: string[];
}

function checkBlogQuality(content: string, category: string): QualityCheck {
  const issues: string[] = [];
  let score = 100;
  
  // 1. 길이 체크
  const textOnly = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (textOnly.length < 3000) { issues.push(`텍스트 ${textOnly.length}자 < 3,000자 최소`); score -= 30; }
  if (textOnly.length < 5000) { score -= 10; }
  
  // 2. 인라인 HTML 체크
  if (content.includes('style="background:#') || content.includes('style="color:#')) {
    issues.push('인라인 HTML 하드코딩 색상 포함'); score -= 20;
  }
  
  // 3. 영어 raw 값 체크
  if (/>(trade|subscription|active|closed)</.test(content)) {
    issues.push('영어 raw 값 노출'); score -= 15;
  }
  
  // 4. 보일러플레이트 체크
  if (content.includes('부동산 시장 회복과 함께 실수요자와 투자자 관심이 높아지고')) {
    issues.push('보일러플레이트 문장 감지'); score -= 20;
  }
  
  // 5. 실데이터 존재 확인
  if (category === 'apt' && !(/\d+세대/.test(content) || /\d+만원/.test(content))) {
    issues.push('실데이터(세대수/가격) 없음'); score -= 25;
  }
  
  // 6. 내부 링크 체크
  const internalLinks = (content.match(/\]\(\//g) || []).length;
  if (internalLinks < 3) { issues.push(`내부 링크 ${internalLinks}개 < 3개 최소`); score -= 10; }
  
  // 7. FAQ 체크
  if (!content.includes('자주 묻는') && !content.includes('FAQ') && !content.includes('❓')) {
    issues.push('FAQ 섹션 없음'); score -= 5;
  }
  
  // 8. 목차 템플릿 잔존 체크
  if (content.includes('## 목차')) {
    issues.push('"## 목차" 템플릿 잔존'); score -= 10;
  }
  
  return { pass: score >= 70, score: Math.max(0, score), issues };
}
```

### 8.2 발행 후 모니터링 (주간 크론)

```
매주 월요일 실행:
1. 지난주 발행된 글 중 조회수 0인 글 목록 → 관리자 알림
2. 전체 글 중 품질 점수 50 미만 → unpublish 후보 리스트
3. 조회수 상위 100 글 → 실데이터 최신 업데이트 (가격 변동 반영)
```

---

## 9. 비용 & 일정 추정

| Phase | 작업 내용 | 소요 기간 | API 비용 |
|-------|----------|----------|---------|
| Phase 0 | DB 일괄 수정 (SQL) | 30분 | $0 |
| Phase 1 | C등급 3,726건 재작성 | 8일 | ~$140 |
| Phase 2 | B등급 2,892건 보강 | 6일 | ~$100 |
| Phase 3 | 크론 프롬프트 교체 | 2일 | $0 |
| UI 개선 | 사이드바 + 디자인 | 3일 | $0 |
| **합계** | | **~19일** | **~$240** |

Batch API 50% 할인 적용 시 ~$120.

---

## 10. 성공 지표 (KPI)

| 지표 | 현재 | 1개월 후 목표 | 3개월 후 목표 |
|------|------|-------------|-------------|
| 평균 조회수/글 | 68 | 150 | 300 |
| 포털 1페이지 진입 글 수 | ~50 | 200 | 500 |
| 평균 체류시간 | 30초 추정 | 90초 | 2분+ |
| 평균 콘텐츠 길이 (순수 텍스트) | 2,800자 | 5,000자+ | 5,000자+ |
| 내부 링크 클릭률 | 측정 안됨 | 5% | 10% |
| FAQ SERP 노출 | 0 | 50+ | 200+ |
| 인라인 HTML 포함 글 | 3,744 | 0 | 0 |
| 품질 점수 70+ 비율 | 12% | 60% | 90% |

---

## 11. 기술 구현 우선순위

1. ✅ **Phase 0**: 즉시 SQL 일괄 수정 (영어→한글, 오타, placeholder)
2. 🔨 **실데이터 주입 함수**: `getEnrichmentData(category, slug)` 구현
3. 🔨 **품질 게이트 함수**: `checkBlogQuality()` 구현
4. 🔨 **새 리라이트 프롬프트**: 카테고리별 완성형 템플릿
5. 🔨 **blog-enrich-rewrite 크론**: C등급 재작성 전용
6. 🔨 **블로그 사이드바 컴포넌트**: `BlogSidebar.tsx`
7. 🔨 **핵심 지표 카드 컴포넌트**: `BlogMetricCards.tsx`
8. 🔨 **기존 크론 프롬프트 교체**: 모든 blog-* 크론
9. 🔨 **Unsplash 키워드 정밀화**: 카테고리별 검색어 개선
10. 🔨 **주간 품질 모니터링 크론**: `blog-quality-monitor`

---

*이 문서는 카더라 블로그 시스템의 전면 재설계 마스터플랜입니다.*
*실행 시 각 Phase별로 상세 구현 사항을 별도 문서화합니다.*
