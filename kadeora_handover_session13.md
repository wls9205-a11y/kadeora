# 카더라 인수인계 문서 (세션 13 기준)
> 최종 갱신: 2026-03-22
> 최신 커밋: `de89cb1` (session13 브랜치)

---

## 1. 프로젝트 기본 정보

| 항목 | 값 |
|------|-----|
| 서비스명 | 카더라 (kadeora) |
| URL | https://kadeora.app |
| GitHub | github.com/wls9205-a11y/kadeora |
| 프레임워크 | Next.js 15 (App Router) |
| 호스팅 | Vercel |
| DB | Supabase (PostgreSQL 17, ap-northeast-2) |
| 인증 | Supabase Auth (카카오 OAuth) |
| 결제 | 토스페이먼츠 (상점 전용, 테스트키) |
| 사업자 | 카더라 / 278-57-00801 / 대표 노영진 |

---

## 2. 아키텍처 요약

```
[Vercel] → Next.js App Router (SSR + ISR)
   ├─ Supabase (DB + Auth + Storage + Realtime)
   ├─ Vercel Cron (블로그 자동 발행, 주식 갱신, 푸시 등)
   ├─ KIS API / Naver Finance / Yahoo Finance (주식 시세)
   ├─ 국토교통부 OpenAPI (청약 데이터)
   └─ 토스페이먼츠 (상점 결제)
```

**주요 규칙:**
- `nickname` (not username), `author_id` (not user_id)
- points → RPC로만 변경
- CSP → `middleware.ts`에서만 관리
- CSS 변수 기반 테마 (`var(--brand)`, `var(--bg-surface)` 등)

---

## 3. 데이터 현황 (2026-03-22 기준)

| 테이블 | 건수 | 비고 |
|--------|------|------|
| profiles | 111 | 실제 11 + 시드 100 |
| posts | 3,715 | is_deleted=false 기준 |
| comments | 1,547 | is_deleted=false 기준 |
| blog_posts | 198 | is_published=true 기준 |
| stock_quotes | 249 | 국내+해외 종목 |
| apt_subscriptions | 106 | 청약 일정 |

- 시드 유저: `id LIKE 'aaaaaaaa-%'` (100명)
- 실제 유저: 11명 (카카오 가입)

---

## 4. 주요 기능

| 기능 | 상태 | 비고 |
|------|------|------|
| 피드 (커뮤니티) | ✅ 운영중 | 카테고리별 필터, 좋아요, 댓글, 공유 |
| 주식 시세 | ✅ 운영중 | KIS/Naver/Yahoo 3중 폴백, 시총 표시+정렬 |
| 부동산 (청약/미분양) | ✅ 운영중 | 지역별 현황판, 미분양 현황판, 가점진단 |
| 블로그 | ✅ 운영중 | 자동 발행 (일 11종), SEO 최적화 |
| 토론 | ✅ 운영중 | 카더라라운지 + 서브방 |
| 상점 | ✅ 운영중 | 토스페이먼츠 결제 (테스트키) |
| 프리미엄 | ❌ 삭제 | 세션13에서 삭제, DB 테이블 유지 |
| 푸시 알림 | ✅ 운영중 | FCM + Service Worker |
| PWA | ✅ 운영중 | 설치 배너, 오프라인 지원 |

---

## 5. 크론 스케줄

| 크론 | 스케줄 | 엔드포인트 |
|------|--------|-----------|
| stock-refresh | 장중 5분마다 | /api/stock-refresh |
| blog-daily | 매일 07:00 KST | /api/cron/blog-daily (8종) |
| blog-afternoon | 평일 14:00 KST | /api/cron/blog-afternoon (재테크 3종) |
| blog-weekly | 매주 월 09:00 | /api/cron/blog-weekly |
| blog-monthly | 매월 1일 09:00 | /api/cron/blog-monthly |
| blog-apt-new | 매일 10:00 | /api/cron/blog-apt-new |
| push-apt-deadline | 매일 09:00 | /api/cron/push-apt-deadline |
| refresh-apt-cache | 매일 06:00 | /api/admin/refresh-apt-cache |

---

## 6. 완료 작업 (세션별)

### 세션 1~9 (초기 구축)
- 프로젝트 생성, Supabase 연동, 카카오 로그인
- 피드 CRUD, 댓글, 좋아요, 신고, 포인트/등급 시스템
- 주식 시세 페이지, 부동산 청약 페이지
- 블로그 자동 발행 시스템
- 토론방, 상점, 검색
- 푸시 알림 (FCM), PWA
- 어드민 대시보드
- 시드 데이터 (유저 100명, 게시글, 댓글)

### 세션 10
- robots.txt 네이버봇 허용
- 블로그 댓글 CTA 배너
- OG 카테고리별 색상
- 글로벌 에러 바운더리 + Sentry

### 세션 11
- 구독 DB 테이블 (plans/subscriptions/payments)
- 태그 기능 (posts.tags[] + GIN 인덱스 + TagSelector UI)
- 공유 버튼 통합 (카카오/X/페이스북/네이버/네이티브/링크복사)
- 등급 이모지 + 등급명 전면 표시
- 피드 카드 높이 축소 (본문 2줄 clamp)
- 피드 가이드북 배너
- 인기검색어 모바일 중앙 배치
- 글씨 크기 조절 FontSizeControl
- 토론 카더라라운지 메인 배치 + 서브방 그리드
- 글쓰기 간결 디자인
- 시드 댓글 카테고리별 템플릿
- 비로그인 5초 블라인드 GuestGate
- 블로그 소셜 공유 + 관련 글 추천
- 브랜드 이미지 5종 배포 (public/images/brand/)
- 블로그 198개 SEO 일괄 (image_alt + meta_description + meta_keywords)
- 블로그 크론 자동 SEO (blog-seo-utils.ts)
- 사이트맵 이미지 URL 포함
- OG API 에러 시 브랜드 이미지 폴백
- JSON-LD Organization 로고

### 세션 12
- 등급명 전체 표시 (grade>=3 제한 제거)
- 부동산 상세 공유 버튼 + 청약홈 링크
- 모바일 하단 네비 5칸 (피드/주식/+/부동산/토론)
- 모바일 상단 더보기 메뉴 이동
- 부동산 현황판 프로그레스바 + 미분양 지역별 현황판
- 블로그 자동 발행 확대 (일 11종 + 오후 크론)
- 공유 플랫폼 확대 (페이스북/네이버)
- 피드 인기검색어 칩 삭제 + 실시간 배너 중앙
- 주식 시총 표시 + 시총순 정렬
- 토스 결제 플로우 구현 (-> 세션13에서 삭제)
- profiles 누락 11명 복구
- 어드민 실제/시드 회원 분리 표시

### 세션 13
- 프리미엄 페이지 및 결제 기능 삭제 (DB 유지)
- 인수인계 문서 갱신
- 블로그 FAQ 아코디언 (자동 파싱 + JSON-LD)
- 디자인 일관성 패스

---

## 7. 앞으로 해야 할 작업

### 🔴 긴급
- [ ] Google Search Console 소유권 인증 + 사이트맵 제출
- [ ] 네이버 서치어드바이저 사이트 등록 + 사이트맵 제출
- [ ] 이 두 가지가 끝나야 검색 유입이 시작됨

### 🟡 높음
- [ ] 유저 유입 전략 수립 (SNS, 커뮤니티, 광고)
- [ ] 토스 라이브키 전환 (프리미엄 재개 시)
- [ ] 블로그 자동 발행 품질 개선 (GPT 연동 등)
- [ ] 모바일 UX 개선 (터치 반응, 스크롤 성능)

### 🟢 보통
- [ ] 다크/라이트 토글 고도화
- [ ] i18n (다국어 지원)
- [ ] 주식 차트 (캔들, 이평선)
- [ ] AI 종목분석
- [ ] 프리미엄 구독 재개 (향후)

---

## 8. 환경변수 (Vercel)

| 변수 | 용도 | 비고 |
|------|------|------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase URL | |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase Anon Key | |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Admin | 서버만 |
| CRON_SECRET | 크론 인증 | Bearer 토큰 |
| KIS_APP_KEY / KIS_APP_SECRET | 한국투자증권 API | 없으면 Naver 폴백 |
| TOSS_SECRET_KEY | 토스페이먼츠 시크릿 | 상점용, 테스트키 |
| NEXT_PUBLIC_TOSS_CLIENT_KEY | 토스 클라이언트 키 | 상점용, 테스트키 |
| NEXT_PUBLIC_SITE_URL | 사이트 URL | https://kadeora.app |
| NEXT_PUBLIC_VAPID_PUBLIC_KEY | 푸시 VAPID | FCM용 |
| VAPID_PRIVATE_KEY | 푸시 VAPID Private | 서버만 |

> 토스키는 유지 (상점 결제용). 프리미엄 기능은 비활성 상태.

---

## 9. DB 성능 최적화 기록

### 인덱스
- posts: `created_at DESC`, `author_id`, `category`, `is_deleted`
- comments: `post_id`, `author_id`, `created_at`
- blog_posts: `slug UNIQUE`, `is_published`, `published_at DESC`
- stock_quotes: `symbol UNIQUE`, `market_cap DESC`
- trending_keywords: `heat_score DESC`
- post_likes: `(user_id, post_id) UNIQUE`

### 마이그레이션 (세션 11~13)
- `add_blog_seo_columns`: image_alt, meta_description, meta_keywords
- `create_plans_subscriptions`: plans, subscriptions 테이블
- `add_room_to_chat_messages`: chat_messages.room 컬럼
- `add_tags_to_posts`: posts.tags jsonb[] + GIN 인덱스

---

## 10. 파일 구조 (주요)

```
src/
├── app/
│   ├── (main)/           # 메인 레이아웃 (네비+사이드바)
│   │   ├── feed/         # 피드 (커뮤니티)
│   │   ├── stock/        # 주식 시세
│   │   ├── apt/          # 부동산 (청약/미분양)
│   │   ├── blog/         # 블로그
│   │   ├── discuss/      # 토론
│   │   ├── shop/         # 상점
│   │   ├── hot/          # HOT 게시글
│   │   ├── profile/      # 프로필
│   │   └── ...
│   ├── admin/            # 어드민 대시보드
│   ├── api/              # API 라우트
│   │   ├── cron/         # 크론 작업
│   │   ├── payment/      # 상점 결제 (토스)
│   │   ├── stock-refresh/# 주식 갱신
│   │   ├── push/         # 푸시 알림
│   │   └── ...
│   └── ...
├── components/
│   ├── Navigation.tsx    # 헤더 + 모바일 하단 네비
│   ├── Sidebar.tsx       # 좌측 사이드바
│   ├── RightPanel.tsx    # 우측 패널
│   ├── ShareButtons.tsx  # 소셜 공유 버튼
│   ├── GuestGate.tsx     # 비로그인 블라인드
│   ├── FontSizeControl.tsx # 글씨 크기 조절
│   ├── BlogCommentCTA.tsx  # 블로그 댓글 CTA
│   ├── BlogRelatedPosts.tsx # 관련 글 추천
│   ├── TagSelector.tsx   # 태그 선택기
│   └── ...
├── lib/
│   ├── supabase-server.ts  # 서버 Supabase 클라이언트
│   ├── supabase-browser.ts # 브라우저 Supabase 클라이언트
│   ├── blog-seo-utils.ts   # 블로그 SEO 유틸
│   ├── grade-utils.ts      # 등급 유틸
│   ├── constants.ts        # 상수 (지역, 등급 등)
│   └── ...
└── types/
    └── database.ts         # DB 타입 정의
```

---

## 11. 참고사항

- **시드 데이터**: 100명의 가상 유저 (`aaaaaaaa-xxxx-...`)가 자동 생성한 게시글/댓글
- **블로그 자동 발행**: 크론이 Supabase에서 데이터를 조합하여 blog_posts에 INSERT
- **주식 시세 갱신 순서**: KIS API -> Naver Finance -> Yahoo Finance (3중 폴백)
- **해외 주식**: Yahoo Finance만 사용 (USD 종목)
- **토스 결제**: 현재 테스트키 → 라이브 전환은 Vercel 환경변수 교체만 필요
