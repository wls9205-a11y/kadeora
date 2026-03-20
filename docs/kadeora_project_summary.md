# 카더라 (kadeora.app) 프로젝트 현황 요약
> 2026-03-20 기준 / 새 채팅방에서 이 파일 하나로 컨텍스트 복원용

---

## 1. 프로젝트 기본 정보

| 항목 | 값 |
|---|---|
| 서비스명 | 카더라 (kadeora.app) |
| 설명 | 대한민국 소리소문 정보 커뮤니티 (주식·부동산·청약·동네 정보) |
| 스택 | Next.js 15 App Router + Supabase Pro + Vercel Pro |
| GitHub | wls9205-a11y/kadeora (main 브랜치) |
| 도메인 | kadeora.app |
| Supabase 프로젝트 ID | tezftxakuwhsclarprlz (서울 리전) |
| Vercel 프로젝트 ID | prj_2nDcTjEcgAEew1wYdvVF57VljxJQ |
| Vercel 팀 ID | team_oKdq68eA7PwgcxFs61wGPZ7j |
| 사업자등록번호 | 278-57-00801 (대표: 노영진) |
| 이메일 | kadeora.app@gmail.com |

---

## 2. DB 스키마 핵심 규칙

> **반드시 숙지할 것 — 컬럼명 오인 시 버그 발생**

| 규칙 | 올바른 이름 | 잘못된 이름 (쓰지 말 것) |
|---|---|---|
| 닉네임 | `nickname` | `username` |
| 작성자 ID | `author_id` | `user_id` (posts/comments) |
| 팔로워 | `follower_id` / `followee_id` | `from_id` / `to_id` |
| 가격 | `price_krw` | `price` |

---

## 3. DB 테이블 현황 (2026-03-20)

| 테이블 | 행 수 | 설명 |
|---|---|---|
| posts | 3,656 | 게시글 (30분마다 크론 시드) |
| profiles | 100 | 유저 (실제 8명 + 시드 92명, prefix: aaaaaaaa-) |
| comments | 1,499 | 댓글 |
| stock_quotes | 150 | 주식 종목 (KOSPI 82, KOSDAQ 19, NASDAQ 24, NYSE 25) |
| stock_comments | 0 | 주식 한줄평 (신규) |
| stock_comment_likes | 0 | 한줄평 좋아요 (신규) |
| stock_comment_reactions | 0 | 한줄평 이모지 리액션 (신규) |
| apt_subscriptions | 100 | 청약 정보 (오늘 05:56 갱신) |
| apt_cache | 1 | 청약 캐시 (JSONB 1건 저장 구조 — 정상) |
| unsold_apts | 35 | 미분양 아파트 |
| chat_messages | 20 | 라운지 채팅 (parent_id 컬럼 있음 — 답글 지원) |
| follows | - | follower_id / followee_id |
| bookmarks | - | post_id 기반 북마크 |
| notifications | - | 푸시 알림 |
| post_likes | - | 게시글 좋아요 |
| reports | 1 | 신고 |
| site_notices | - | 공지사항 |
| megaphones | - | 전광판 |
| banned_words | - | 금지어 |
| point_history | - | 포인트 내역 |
| page_views | - | 페이지뷰 |

### stock_comments 컬럼 (2026-03-20 추가됨)
```sql
id uuid PRIMARY KEY
symbol text
user_id uuid → profiles(id)
content text
likes_count int DEFAULT 0
replies_count int DEFAULT 0
parent_id uuid → stock_comments(id)  -- 답글
created_at timestamptz
```

---

## 4. 환경변수 현황 (Vercel)

| 키 | 상태 | 값/설명 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role |
| `CRON_SECRET` | ✅ | `kadeora-secret-2026` |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | ✅ | `test_ck_Z61JOx...` (테스트 모드) |
| `TOSS_SECRET_KEY` | ✅ | `test_sk_LlDJaYngro...` (테스트 모드) |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | ✅ | `6d1e7e33bbd7619adc2e6c36ae37f0b7` |
| `NEXT_PUBLIC_KAKAO_APP_KEY` | ✅ | 등록됨 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ✅ | 푸시 알림용 |
| `VAPID_PRIVATE_KEY` | ✅ | 푸시 알림용 |
| `VAPID_SUBJECT` | ✅ | 푸시 알림용 |
| `ANTHROPIC_API_KEY` | ✅ | AI 기능용 |
| `SENTRY_DSN` | ✅ | 에러 트래킹 |
| `NEXT_PUBLIC_SENTRY_DSN` | ✅ | 클라이언트 에러 트래킹 |
| `NEXT_PUBLIC_CACHE_VERSION` | ✅ | |
| `UNSOLD_API_KEY` | ✅ | data.go.kr 미분양 API |
| `CRON_SECRETT` | ❌ **삭제됨** | 오타 키 — 삭제 완료 |
| `NEXT_PUBLIC_KAKAO_JS_KEY` (구) | - | 이미 있었음 (`kadeora-secret-2026`) |

### 아직 미등록 환경변수
| 키 | 설명 |
|---|---|
| `NEXT_PUBLIC_BUSINESS_REPORT_NUMBER` | 통신판매업 신고번호 |
| `KIS_API_KEY` 등 | 한국투자증권 실시간 주식 API (미연동) |

---

## 5. Vercel Cron Jobs (vercel.json)

| 엔드포인트 | 스케줄 | 설명 |
|---|---|---|
| `/api/cron/seed-posts` | `*/30 * * * *` | 30분마다 시드 게시글 생성 |
| `/api/cron/invite-reward` | `0 0 * * *` | 매일 자정 초대 보상 |
| `/api/cron/cleanup` | `0 3 * * *` | 매일 새벽 3시 정리 |
| `/api/cron/cleanup-pageviews` | `0 3 * * 0` | 매주 일요일 새벽 페이지뷰 정리 |
| `/api/stock-refresh` | `*/5 9-16 * * 1-5` | 평일 장시간 5분마다 주식 시세 갱신 |

---

## 6. 오늘(2026-03-20) 작업 내역 — 커밋 순서

### 커밋 1 — 어드민 전면 재설계 (1차)
- 사이드바 #0f172a 다크 네이비 + 활성 메뉴 brand border
- AdminBadge, ActionButton 공통 컴포넌트
- 유저 관리 포인트 컬럼 + set_points API
- 대시보드 결제 KPI + 숨김 게시글 수

### 커밋 2 — 어드민 전면 재설계 (2차)
- layout 240px fixed 다크사이드바 + 모바일 상단탭
- AdminComponents: KpiCard/ActionBtn/Badge/AdminTable/PageHeader
- dashboard KPI 8개 + 최근 게시글/가입자 2열
- users API: ban/unban/toggle_admin/set_points
- 댓글 관리 페이지 신규 + GET/PATCH API

### 커밋 3 — 피드+글읽기+글쓰기 트위터/스레드 스타일
- PostCard: 8색 해시 아바타, 등급이모지, 🤍, slug URL
- FeedClient: "무슨 소문이 있나요?" 빠른 글쓰기 프롬프트
- feed/[id]: 제목 28px, 아바타 40px 컬러, 본문 16px/1.9
- WriteClient: 카테고리 pill, 하단 고정 바, 노션 스타일

### 커밋 4 — SEO 전면 최적화
- slug URL 라우팅 (숫자 URL → slug URL 307 redirect)
- canonical URL 각 페이지별
- sitemap: slug 기반, 인기글 priority 0.8, stale stock 필터링
- DB: 3,653개 게시글 slug 정상화 (post-숫자 → 한글 슬러그)

### 커밋 5 — 어드민 KPI/버튼/RPC 개선
- get_seed_stats() RPC 함수로 교체
- KPI 카드 6개 + 아이콘 + 컬러 border-left
- 버튼 결과 3초 자동 사라짐
- 숨김 글 189개 원인 파악 (구버전 시드, 복구 완료)

### 커밋 6 — 라운지 전면 재설계
- 디스코드 스타일: 투명 배경 + hover 효과
- 답글 스레드: parent_id IS NULL 메인 + replies JOIN
- @멘션 드롭다운 (200ms debounce, 6명, 키보드 네비)
- chat_messages.parent_id 컬럼 + 인덱스 추가 (DB migration)

### 커밋 7 — 주식 페이지 전면 개선
- 정렬 드롭다운 (기본/등락률/가격)
- 가격 카드 borderRadius 14, 36px 가격, 금액+% 변동
- 시세없음 → "⏳ 시세 정보 준비 중"
- StockCommentInline: 24px 컬러 아바타, 본인 삭제, 100자 제한

### 커밋 8 — OG/공유 전면 개선
- /api/og 재설계: 다크 그라데이션, 카테고리 뱃지, 좋아요/댓글 수
- 파라미터 없으면 홈 OG 이미지 반환
- feed/[id] generateMetadata: og:image 중복 제거
- ShareButtons: 바텀시트 (카카오/X/밴드/링크복사), 56px 원형 버튼

### 커밋 9 — GuestGate 로그인 유도 방식 변경
- 기존: 5회 페이지뷰 → 블러+모달 차단
- 변경: 15초 OR 스크롤 500px → 하단 팝업
- X 닫기 → sessionStorage 저장

### 커밋 10 — 토스 환경변수 Redeploy (빈 커밋)
- TOSS_SECRET_KEY, NEXT_PUBLIC_TOSS_CLIENT_KEY 등록 후 Redeploy

### 커밋 11 — 전수점검 버그 수정
- 크론 CRON_SECRET 단일 패턴 통일 (7개 route)
- pageview fire-and-forget (await 제거 → 즉시 응답)
- trending revalidate=300 캐싱
- GuestGate sessionStorage → localStorage 24시간 만료
- 피드 force-no-store 제거 → revalidate=30
- stock_quotes NOW_SAP → NOW 수정
- DB: 중복 인덱스 4개 제거

### 커밋 12 — CRON_SECRETT 오타 키 제거 (빈 커밋)
- Vercel에서 CRON_SECRETT (T 2개) 삭제 완료

### 커밋 13 — 부동산 갱신 + stock-refresh 크론 등록
- refresh-apt-cache 401 에러 메시지 구체화
- stock-refresh vercel.json 크론 등록 (평일 09-16시 5분마다)
- cleanup-pageviews 크론 등록
- trigger-cron CRON_SECRETT fallback 제거

### 커밋 14 — 주식 한줄평 네이버증권 스타일 전면 재설계
- StockComments.tsx 419줄 신규 생성
- 아바타 36px 해시컬러 + 등급뱃지 + 팔로우 버튼
- 글쓰기: 확장형 textarea + 200자 카운터 + "남기기"
- 좋아요: stock_comment_likes 토글 + 낙관적 UI
- 이모지 리액션: 📉📈❤️👍🙏😊😮 7종 (stock_comment_reactions upsert)
- 댓글 확장: 리액션바 + 답글 입력
- ⋯ 메뉴: 삭제(본인) / 신고(타인)
- 정렬: 최신순 / 인기순
- DB: stock_comments (likes_count/replies_count/parent_id 추가)
- DB: stock_comment_likes, stock_comment_reactions 테이블 + RLS

### 커밋 15 — 카카오SDK + 팔로우 + 무한스크롤
- KakaoInit 컴포넌트: Kakao.init() 자동 호출
- StockComments 팔로우 토글 실제 연동 (follows INSERT/DELETE)
- 피드 무한스크롤 검증 + "모든 게시글을 읽었어요 ✓" 메시지
- Sentry 기존 설정 확인

---

## 7. DB 변경 사항 (오늘 직접 실행)

### 추가된 컬럼
```sql
-- stock_comments
ALTER TABLE stock_comments ADD COLUMN likes_count int DEFAULT 0;
ALTER TABLE stock_comments ADD COLUMN replies_count int DEFAULT 0;
ALTER TABLE stock_comments ADD COLUMN parent_id uuid REFERENCES stock_comments(id);

-- chat_messages (이전 세션)
ALTER TABLE chat_messages ADD COLUMN parent_id uuid;
```

### 새로 생성된 테이블
```sql
-- 주식 한줄평 좋아요
stock_comment_likes (comment_id uuid, user_id uuid, PRIMARY KEY(comment_id, user_id))

-- 주식 한줄평 이모지 리액션
stock_comment_reactions (comment_id uuid, user_id uuid, emoji text, UNIQUE(comment_id, user_id))
```

### 제거된 인덱스 (중복)
```sql
DROP INDEX idx_comments_post_created;      -- idx_comments_post_not_deleted와 중복
DROP INDEX idx_posts_active_likes;         -- idx_posts_is_deleted_likes와 중복
DROP INDEX idx_posts_region_category_deleted; -- idx_posts_category_region_deleted와 중복
DROP INDEX idx_posts_view_count;           -- 미사용
```

### 데이터 수정
```sql
UPDATE stock_quotes SET symbol = 'NOW' WHERE symbol = 'NOW_SAP';
-- slug 3,653개 정상화 (post-숫자 → 한글슬러그-숫자)
-- stock_quotes sector 컬럼 108개 업데이트
```

---

## 8. 주요 파일 구조

```
src/
├── app/
│   ├── (main)/
│   │   ├── feed/
│   │   │   ├── page.tsx          -- revalidate=30, 서버컴포넌트
│   │   │   ├── FeedClient.tsx    -- 무한스크롤, 빠른글쓰기
│   │   │   └── [id]/page.tsx     -- slug URL, OG 메타데이터
│   │   ├── stock/
│   │   │   ├── StockClient.tsx   -- 테마탭, 정렬, 섹터
│   │   │   └── [symbol]/page.tsx -- 가격카드, StockComments
│   │   ├── apt/                  -- 청약/부동산
│   │   ├── discuss/              -- 라운지 채팅
│   │   └── write/WriteClient.tsx -- 글쓰기
│   ├── admin/
│   │   ├── layout.tsx            -- 240px 다크 사이드바
│   │   ├── page.tsx              -- KPI 대시보드
│   │   ├── users/                -- 회원 관리
│   │   ├── posts/                -- 게시글 관리
│   │   ├── comments/             -- 댓글 관리
│   │   ├── reports/              -- 신고 관리
│   │   ├── notices/              -- 공지/전광판
│   │   └── system/               -- 금지어/크론/피드백
│   ├── api/
│   │   ├── cron/
│   │   │   ├── seed-posts/       -- 30분마다 시드 게시글
│   │   │   ├── cleanup/          -- 매일 정리
│   │   │   └── cleanup-pageviews/-- 매주 정리
│   │   ├── admin/
│   │   │   ├── refresh-apt-cache/-- 청약 데이터 갱신 (POST, Supabase token 인증)
│   │   │   ├── trigger-cron/     -- 어드민에서 크론 수동 실행
│   │   │   └── users/[id]/       -- ban/unban/toggle_admin/set_points
│   │   ├── analytics/
│   │   │   └── pageview/         -- fire-and-forget 방식
│   │   ├── search/
│   │   │   └── trending/         -- revalidate=300 캐시
│   │   ├── stock-refresh/        -- 주식 시세 갱신 (CRON_SECRET 인증)
│   │   └── og/route.tsx          -- 동적 OG 이미지 (1200×630)
│   └── layout.tsx                -- KakaoInit 포함
├── components/
│   ├── shared/PostCard.tsx        -- 8색 해시 아바타, slug URL
│   ├── GuestGate.tsx              -- 15초/500px 팝업, localStorage 24h
│   ├── ShareButtons.tsx           -- 카카오/X/밴드/링크복사 바텀시트
│   ├── StockComments.tsx          -- 네이버증권 스타일 한줄평 (신규)
│   ├── KakaoInit.tsx              -- Kakao.init() 자동 초기화 (신규)
│   └── admin/AdminComponents.tsx  -- KpiCard/ActionBtn/Badge 등
└── lib/
    ├── supabase-server.ts
    └── constants.ts
```

---

## 9. 인증 방식

### 크론 API
```ts
// 모든 /api/cron/* 및 /api/stock-refresh 통일
const authHeader = req.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### 어드민 API
```ts
// /api/admin/* — Supabase session token
const token = request.headers.get('authorization')?.replace('Bearer ', '');
const { data: { user } } = await supabase.auth.getUser(token);
if (!user || !profile.is_admin) return 401;
```

---

## 10. 아바타 컬러 함수 (전역 공통)

```ts
const AVATAR_COLORS = ['#FF5B36','#FF8C42','#4CAF50','#2196F3','#9C27B0','#E91E63','#FF9800','#00BCD4'];
const getAvatarColor = (str: string) => {
  const hash = (str || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};
```

---

## 11. OG 이미지 API

```
GET /api/og
파라미터:
  title    - 게시글 제목 (없으면 홈 OG 반환)
  author   - 작성자 닉네임
  category - apt | stock | local | free
  likes    - 좋아요 수
  comments - 댓글 수

반환: 1200×630 PNG
디자인: 다크 그라데이션 (#0d1117 → #1a1f2e), 카더라 로고, 제목, 작성자, 통계
```

---

## 12. 현재 남은 과제 (코드 외)

| 항목 | 우선순위 | 설명 |
|---|---|---|
| 실제 유저 유입 | 🔴 최우선 | SNS 홍보, 지인 초대 |
| 카카오 공유 실제 테스트 | 🔴 | 게시글 공유 후 OG 이미지 표시 확인 |
| 토스페이먼츠 라이브 심사 | 🟡 | 현재 테스트 키 — 실서비스 결제 오픈 필요 |
| Google Play 출시 | 🟡 | 신원확인 → 전화번호 인증 |
| Apple Developer ($99) | 🟡 | iOS 앱 배포 |
| KIS API 키 등록 | 🟢 | 실시간 주식 시세 (현재 크론 30분마다 갱신) |
| 통신판매업 신고번호 | 🟢 | NEXT_PUBLIC_BUSINESS_REPORT_NUMBER |

---

## 13. 현재 서비스 상태 (2026-03-20 19:30 기준)

- **에러**: 거의 없음 (AuthApiError 간헐 1건 — Supabase 세션 만료 이슈)
- **크론**: 정상 작동 (30분마다 게시글 생성 확인)
- **피드**: revalidate=30 캐시 적용, 무한스크롤
- **주식**: 평일 장시간 5분마다 시세 갱신 (내일부터)
- **부동산**: 청약 100건 정상 (오늘 05:56 갱신)
- **배포**: 최신 커밋 `4ac6721` READY ✅
