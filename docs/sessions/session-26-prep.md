# 세션 26 준비 — 디자인 시스템 정비 + UI 고도화

**시작 명령:** "docs/STATUS.md 읽고 작업 이어가자"

---

## 디자인 감사 결과 (전체 코드베이스 분석)

### 🔴 심각 (즉시 수정)

#### 1. 색상 하드코딩 — `#2563EB` 직접 사용 72곳+
CSS 변수 `var(--brand)`가 있지만, 50%+ 코드에서 직접 #2563EB 사용.
테마 변경 시 일괄 수정 불가능. 전부 CSS 변수로 교체 필요.

**위치:** 모든 탭 컴포넌트 (SubscriptionTab, OngoingTab, RedevTab, TransactionTab, UnsoldTab),
StockClient, FeedClient, BlogPage, SearchClient 등

#### 2. border-radius 일관성 없음 — 6가지 값 혼용
- 카드: 12, 14, 16 혼용
- 버튼: 6, 8, 10, 12, 999 혼용
- 모달: 16, 20 혼용
- 필 버튼: 999 (일관됨)
→ 디자인 토큰으로 `--radius-sm(6)`, `--radius-md(10)`, `--radius-lg(14)`, `--radius-xl(20)`, `--radius-full(999)` 통일 필요

#### 3. 패딩 일관성 없음
- 페이지 래퍼: `0 12px`, `0 16px`, 없음 혼용
- 카드 내부: 12, 14, 16, 20 혼용
- 섹션 간격: marginBottom 8~20 혼용

### 🟡 중요 (디자인 품질)

#### 4. hover/focus 상태 누락
- 대부분의 카드에 `:hover` 없음 (일부만 onMouseEnter 사용)
- 키보드 `:focus-visible` 전무
- 필터 버튼에 active/pressed 피드백 없음

#### 5. 모달 디자인 불일치
- 분양중/재개발/실거래 모달: 각각 다른 스타일
- 닫기 버튼: ✕, ×, X 혼용
- 상단 드래그 핸들: 유무 혼재
- 배경 어둡기: rgba(0,0,0,0.5), 0.6, 0.7 혼용

#### 6. 빈 상태(Empty State) 디자인 불일치
- 어떤 곳은 이모지 + 설명, 어떤 곳은 텍스트만
- EmptyState 컴포넌트가 있지만 전면 적용 안 됨

#### 7. 로딩 상태 불일치
- Skeleton UI 있지만 적용 범위 제한
- 일부 페이지: 텍스트 "로딩 중..."
- 일부 페이지: 빈 화면

#### 8. 블로그 본문 타이포그래피 개선 필요
- 코드 블록 스타일 미약
- 이미지 캡션 스타일 없음
- 인용구(blockquote) 더 눈에 띄게

### 🟢 개선 기회

#### 9. 라이트 테마 부재
- 다크 모드만 존재 (light theme 전무)
- `prefers-color-scheme` 미대응
→ 즉시 필요하지 않지만, CSS 변수 기반이라 추후 추가 가능한 구조

#### 10. 애니메이션/전환 최소
- 페이지 전환: TopLoadingBar만 (좋음)
- 탭 전환 애니메이션 없음
- 카드 등장 애니메이션 없음 (stagger 효과 추가하면 느낌 UP)

#### 11. 데스크탑 레이아웃 활용 부족
- 대부분 maxWidth: 720 (모바일 first)
- StockClient만 1000px
- 데스크탑에서 좌우 여백이 넓어 공간 낭비

#### 12. 마이크로 인터랙션 부족
- 좋아요/관심 버튼: 즉시 전환 (bounce 없음)
- 스크롤 to top 버튼 없음
- 풀투리프레시: 이미 있음 (좋음)

---

## 세션 26 작업 계획

### Phase 1: 디자인 토큰 통일 ✅ 완료
1. border-radius 5단계 토큰 정의 + 전체 교체
2. spacing 토큰 활용도 확장
3. 하드코딩 색상 → CSS 변수 교체 (주요 파일)

### Phase 2: 카드/모달/버튼 일관성 ✅ 완료
4. 모달 통일 (배경, 닫기, 드래그 핸들, border-radius)
5. 카드 hover 효과 전역 적용
6. 필(Pill) 버튼 통일 컴포넌트
7. Empty State 전면 적용

### Phase 3: 블로그 타이포그래피 ✅ 완료
8. 코드 블록 스타일 강화
9. 이미지 캡션 + figure 스타일
10. blockquote 강화

### Phase 4: 인터랙션/애니메이션 ✅ 완료
11. 카드 등장 stagger 애니메이션
12. 좋아요/관심 bounce 효과
13. 스크롤 to top 버튼

### Phase 5: 추가 기능 (일부 완료)
14. 주식 크론 데이터 채우기
15. 실거래가 YoY 비교 (2025 데이터)
16. 종목 비교 URL 파라미터 지원 ✅

---

## 현재 DB 현황 (세션 25 기준)

| 테이블 | 건수 |
|--------|------|
| blog_posts (발행) | 14,578 |
| blog_comments | 1,020 (시드) |
| blog_series | 10 (1,393편 매핑) |
| apt_transactions | 4,861 |
| apt_subscriptions | 2,683 |
| redevelopment_projects | 186 |
| unsold_apts | 180 |
| stock_quotes | 150 |
| profiles | 111+ |
| price_alerts | 신규 |
| portfolio_holdings | 신규 |
| apt_reviews | 신규 |

## 크론 현황 (47개)

주요 활성:
- crawl-apt-subscription 매일 06시
- crawl-apt-trade 매일 08시
- stock-refresh 평일 장중 5분마다
- blog-publish-queue 2회/일
- blog-seed-comments 매일 14시 (세션 25 추가)
- check-price-alerts 평일 09~16시 15분마다
- health-check 30분마다

---

## 주의사항 (이전 세션에서 유지)
- profiles.points 직접 UPDATE 절대 금지 → award_points/deduct_points RPC
- 알림은 DB 트리거가 처리 — 수동 INSERT 금지
- CRON_MAP: 크론 추가/삭제 시 라우트파일+vercel.json+CRON_MAP 3곳 동시 반영
- AptClient 205줄 — 탭은 tabs/ 디렉토리 서브 컴포넌트
- blog_comments.blog_post_id (post_id 아님!)
