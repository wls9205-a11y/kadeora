# 카더라 (kadeora.app) 작업 핸드오프 문서
> 2026-03-21 04:30 기준 / 새 채팅방에서 이 파일로 컨텍스트 복원용
> 원본 프로젝트 요약(kadeora_project_summary.md)과 함께 사용

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

---

## 2. 이번 세션에서 완료한 작업 (20+ 커밋)

### 2-1. 기반 정비 (완료 ✅)
- Pretendard 웹폰트 적용
- 브랜드 컬러 CSS 변수 + tailwind 등록
- 타이포그래피 스케일 통일 (줄간격 1.9→1.625)
- stock_comments user_id → author_id 통일
- slug URL 중복 처리 + 307→301 리다이렉트
- 인증/세션 버그 수정 (middleware.ts 세션 갱신)

### 2-2. UX 개선 (완료 ✅)
- GuestGate 15초 팝업 제거 → useAuthGuard 훅 (글쓰기/댓글/좋아요 시에만 로그인 유도)
- 이모지 → lucide-react 아이콘 교체 (PostCard Heart/MessageCircle, 바텀 네비)
- PostCard 리디자인 (카테고리 pill 색상, 정보 위계 정리)
- EmptyState 공통 컴포넌트 (6개 화면 적용)
- 토스트/스낵바 시스템
- 바텀 네비게이션 lucide 아이콘 (Home/Building2/Flame/MessageCircle)
- 헤더 backdrop-blur
- 404 페이지

### 2-3. 콘텐츠 (완료 ✅)
- 시드 크론 개선 (랜덤 시간 분포 + 댓글/좋아요 시뮬레이션)
- SEO 롱테일 시드 전략 (종목명/지역 랜덤 삽입)
- 시드 중복 방지 (24시간 내 동일 제목 체크)
- 캐싱 전략 통일 (feed 60s, 상세 120s, stock 300s, apt 3600s)
- 에러 바운더리 + 스켈레톤 로딩

### 2-4. 기능 (완료 ✅)
- 피드 검색 기능
- 알림 시스템 (Supabase trigger)
- 프로필 페이지
- 다크모드 (next-themes)
- 포인트 적립 (글 +10P, 댓글 +5P, 출석 +10P)
- 등급 시스템 (새싹~인플루언서)

### 2-5. 어드민 (완료 ✅)
- 사이드바 메뉴 그룹핑 + lucide 아이콘
- 대시보드 KPI + 시스템 상태
- 게시글/댓글/유저 벌크 액션
- 신고 관리 카드형
- 서버사이드 페이지네이션 (posts/comments)
- 환경변수 점검 (CRON_SECRETT 제거)

### 2-6. 안정화 (완료 ✅)
- DB 인덱스 점검 + RLS 17개 테이블 활성화
- 번들 최적화 (dynamic import)
- 헬스체크 API (/api/health)
- API 에러 응답 표준화 (api-response.ts)
- 접근성 기본 점검
- OG 이미지 Cache-Control 추가

---

## 3. 현재 알려진 문제 (미해결) 🔴

### 3-1. 댓글 작성 500 에러
- **증상**: /api/comments POST → 500 Internal Server Error
- **이전 원인**: profiles.points 직접 UPDATE → prevent_privilege_escalation 트리거가 차단
- **수정 시도**: award_points RPC 사용으로 변경, 수동 알림 INSERT 제거 (DB 트리거만 사용)
- **현재 상태**: 마지막 수정 후 아직 테스트 미완. 배포는 완료됨.
- **확인 필요**: Vercel 런타임 로그에서 최신 에러 메시지 확인

### 3-2. 좋아요 403 에러
- **증상**: post_likes POST → 403 Forbidden (대량 반복)
- **RLS 상태**: SELECT 누구나 / INSERT 본인 / DELETE 본인 (정상 설정됨)
- **수정 시도**: 수동 알림 INSERT 제거, 알림은 DB 트리거(handle_post_like_insert)가 처리
- **현재 상태**: 마지막 수정 후 아직 테스트 미완
- **확인 필요**: 로그인 상태에서 403이 나는지, 비로그인에서만 나는지 구분

### 3-3. 카카오톡 공유
- **CSP**: middleware.ts에 *.kakao.com + *.kakaocdn.net 와일드카드 추가 완료
- **KakaoInit.tsx**: `<Script>` 태그로 SDK 로드 + onLoad에서 init() 호출
- **ShareButtons.tsx**: SDK 초기화되면 Kakao.Share.sendDefault(), 실패 시 링크 복사 fallback
- **next.config.ts의 CSP 제거**: middleware.ts에서만 CSP 관리 (충돌 해결)
- **서비스 워커 캐시 버전**: 20260321로 업데이트
- **카카오 개발자 콘솔**: kadeora.app 웹 플랫폼 + JS Key 등록 확인됨
- **현재 상태**: CSP에 카카오 도메인 포함 확인됨 (Response Headers에서 확인). 하지만 실제 공유 테스트 미완.

---

## 4. DB 핵심 변경사항 (이번 세션)

### 4-1. 트리거 수정
```sql
-- prevent_privilege_escalation: app.allow_points_update 세션 변수가 'on'이면 바이패스
-- 이전: points/grade/is_admin/is_premium 직접 UPDATE를 모든 클라이언트에서 차단
-- 이후: 세션 변수 설정 시 바이패스 허용
```

### 4-2. RPC 함수
```sql
-- award_points(p_user_id uuid, p_amount int, p_reason text, p_meta jsonb)
--   세션 변수 설정 → profiles.points UPDATE → point_history INSERT
--   reason은 point_reason enum 타입으로 캐스팅

-- deduct_points(p_user_id uuid, p_amount int)
--   세션 변수 설정 → profiles.points 차감 → point_history INSERT

-- admin_toggle_admin(p_user_id uuid, p_value boolean)
--   세션 변수 설정 → profiles.is_admin UPDATE
```

### 4-3. point_reason enum 값
```
게시글작성, 댓글작성, 출석체크, 출석연속보너스, 초대코드보상, 
일일초대1등, 아바타등록, 관리자조정, 구매
```

### 4-4. 중복 트리거 제거
```sql
DROP TRIGGER on_comment_notify ON comments;  -- notify_on_comment만 유지
DROP TRIGGER trigger_notify_on_like ON post_likes;  -- handle_post_like_insert만 유지
```

### 4-5. RLS 정책 (post_likes)
```sql
-- 이전: ALL 정책 하나 (비로그인 SELECT 차단)
-- 이후: SELECT 누구나 / INSERT 본인 / DELETE 본인 분리
```

---

## 5. 아키텍처 핵심 규칙

### 5-1. Supabase 클라이언트 사용 규칙
| 상황 | 클라이언트 | 설명 |
|------|-----------|------|
| 본인 데이터 CRUD | createSupabaseServer() | 유저 세션, RLS 적용 |
| 타인 데이터 수정 (알림/포인트) | getSupabaseAdmin() | service_role, RLS 무시 |
| 포인트 적립/차감 | .rpc('award_points'/deduct_points') | 트리거 바이패스 |
| 프론트엔드 | createSupabaseBrowser() | 쿠키 기반 세션 |

### 5-2. supabase-admin.ts
```ts
// src/lib/supabase-admin.ts — 지연 초기화 패턴
import { createClient, SupabaseClient } from '@supabase/supabase-js';
let _admin: SupabaseClient | null = null;
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _admin;
}
```

### 5-3. profiles.points 직접 UPDATE 절대 금지
- prevent_privilege_escalation 트리거가 차단함
- 반드시 award_points / deduct_points RPC 사용
- is_admin 변경도 admin_toggle_admin RPC 사용

### 5-4. 알림은 DB 트리거가 처리
- 댓글 알림: notify_on_comment 트리거
- 좋아요 알림: handle_post_like_insert 트리거
- API에서 수동으로 notifications INSERT 하지 말 것 (중복 발생)
- 팔로우 알림만 API에서 수동 INSERT (DB 트리거 없음)

---

## 6. CSP (Content Security Policy) — middleware.ts에서만 관리

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://va.vercel-scripts.com https://js.tosspayments.com https://*.kakaocdn.net https://*.kakao.com
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com https://cdn.jsdelivr.net https://*.kakao.com https://*.kakaocdn.net https://accounts.google.com https://api.tosspayments.com https://*.sentry.io https://*.upstash.io https://open.er-api.com
```

**중요**: next.config.ts에는 CSP를 설정하지 말 것 (middleware와 충돌)

---

## 7. 파일 구조 (주요 변경사항)

```
src/
├── lib/
│   ├── supabase-admin.ts    ← 신규: getSupabaseAdmin() 지연 초기화
│   ├── supabase-server.ts
│   ├── avatar.ts            ← 신규: getAvatarColor 통합 유틸
│   ├── constants.ts         ← CATEGORY_STYLES, GRADE_EMOJI 등
│   ├── api-response.ts      ← 신규: 표준 에러 응답
│   └── admin-auth.ts        ← requireAdmin() 유틸
├── hooks/
│   └── useAuthGuard.ts      ← 신규: 비로그인 시 로그인 유도
├── components/
│   ├── shared/
│   │   ├── PostCard.tsx      ← lucide 아이콘 적용
│   │   └── EmptyState.tsx    ← 신규: 빈 상태 공통 컴포넌트
│   ├── ShareButtons.tsx      ← 카카오SDK + fallback 링크복사
│   └── KakaoInit.tsx         ← <Script> 태그 + onLoad init
└── app/
    └── api/
        ├── comments/route.ts ← 수동 알림 제거, award_points RPC
        ├── likes/route.ts    ← 수동 알림 제거, 간소화
        ├── posts/route.ts    ← award_points RPC
        ├── follow/route.ts   ← 전면 재작성
        ├── attendance/       ← award_points RPC
        └── admin/
            ├── posts/bulk/   ← requireAdmin
            └── push-broadcast/ ← notifications 컬럼 수정
```

---

## 8. 새 채팅에서 해야 할 것 (우선순위 순)

### 🔴 최우선: 핵심 기능 동작 확인
1. **댓글 작성 테스트** — F12 Console 열고 댓글 전송. 500이면 Vercel 런타임 로그 확인.
2. **좋아요 테스트** — Heart 클릭. 403이면 로그인 상태 확인 + RLS 재점검.
3. **카카오톡 공유 테스트** — 공유 → 카카오톡. 안 되면 F12 Console에서 Kakao 관련 에러 확인.

### 🟡 디자인 개편
4. **글쓰기 페이지** — 클린 에디터 (테두리 없음, sticky 헤더, 카테고리 pill)
5. **글 읽기 페이지** — 인터랙션 바, 하단 고정 댓글 입력, 다크모드
6. **부동산 페이지** — 테이블→카드 리스트, 상태 뱃지, 지역 필터
7. **주식 페이지** — 종목 카드 디자인, 검색바
8. **HOT 페이지** — 순위 강조, 기간 필터

### 🟢 추가 개선
9. 알림 클릭 시 해당 게시글로 이동 (현재 항상 /feed)
10. 바텀 네비 SSR에서 이모지 → lucide (hydration 후 교체됨, SSR HTML에는 이모지 잔존)
11. FeedClient 미사용 prop/state 정리
12. 어드민 인라인 auth → requireAdmin 통일

---

## 9. 환경변수 (Vercel)

### 서버 전용
- SUPABASE_SERVICE_ROLE_KEY
- CRON_SECRET (kadeora-secret-2026)
- ANTHROPIC_API_KEY
- UNSOLD_API_KEY
- UPSTASH_REDIS_REST_URL / TOKEN
- SENTRY_DSN
- TOSS_SECRET_KEY
- VAPID_PRIVATE_KEY / SUBJECT

### 공개 (NEXT_PUBLIC_)
- NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
- NEXT_PUBLIC_KAKAO_JS_KEY (6d1e7e33bbd7619adc2e6c36ae37f0b7)
- NEXT_PUBLIC_TOSS_CLIENT_KEY
- NEXT_PUBLIC_VAPID_PUBLIC_KEY
- NEXT_PUBLIC_SITE_URL
- NEXT_PUBLIC_SENTRY_DSN
- NEXT_PUBLIC_CACHE_VERSION

---

## 10. 크론 잡 (vercel.json)

| 엔드포인트 | 스케줄 | 설명 |
|---|---|---|
| /api/cron/seed-posts | */30 * * * * | 30분마다 시드 게시글 (1~3개 + 댓글/좋아요) |
| /api/cron/invite-reward | 0 0 * * * | 매일 자정 초대 보상 |
| /api/cron/cleanup | 0 3 * * * | 매일 새벽 정리 |
| /api/cron/cleanup-pageviews | 0 3 * * 0 | 매주 일요일 페이지뷰 정리 |
| /api/stock-refresh | */5 9-16 * * 1-5 | 평일 장중 5분마다 주식 시세 |

---

## 11. 디버깅 팁

- **Vercel 런타임 로그**: Vercel MCP → get_runtime_logs (level: error, since: 5m)
- **DB 직접 확인**: Supabase MCP → execute_sql
- **CSP 확인**: F12 → Network → 문서 요청 → Response Headers → Content-Security-Policy
- **서비스 워커 초기화**: F12 → Application → Service Workers → Unregister → Ctrl+Shift+R
- **배포 확인**: Vercel MCP → get_deployment (idOrUrl: "kadeora.app")
