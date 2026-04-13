# 카더라 STATUS.md
> 마지막 업데이트: 2026-04-13 (세션 98~99 통합 — 이슈 선점 자동발행 시스템 전면 수정)

## 세션 99 최종 — 이슈 선점 + 이메일 + 블로그 품질 개선

### 🔴 Critical — 이슈 선점 자동발행 버그 (오늘 수정)

**[근본 버그] blog_post_id 타입 불일치**
- `blog_posts.id = bigint` ↔ `issue_alerts.blog_post_id = uuid` 타입 불일치
- bigint → uuid 저장 시 silent 실패 → blog_post_id 항상 null
- 강동헤리티지자이 등 발행됐다고 표시됐지만 실제 글 없던 원인
- DB 마이그레이션: blog_post_id uuid → **bigint**
- 코드: `Number(insertResult.id)` 처리

**[버그] trigger-cron URL 삼항 연산자 우선순위**
- `NEXT_PUBLIC_BASE_URL`이 무시되고 `VERCEL_URL`로 크론 호출 → 인증 실패
- "지금 실행" 버튼 안 되던 원인

**[버그] validate_blog_post NO_MAP 조건**
- apt 카테고리 글에 지도 링크 필수인데 이슈 기사엔 없음 → 전부 차단
- `issue-draft`, `issue-manual` 크론은 NO_MAP 면제 처리

**[버그] duplicate_blog 차단 시 draft_content 덮어쓰기**
- skipReasons를 draft_content에 저장 → 기존 AI 콘텐츠 손실 → 재처리 불가
- `block_reason`으로 이동, `draft_content` 보존

**[버그] 발행 API 에러 무시**
- safeBlogInsert 실패해도 `is_published=true` 설정 → 허위 발행 상태
- 에러 처리 추가, `block_reason` DB 기록

**[버그] 유사도 threshold 너무 낮음**
- `check_blog_similarity threshold 0.2` → 정상 이슈도 차단 → 0.35로 완화

**[버그] trigger-cron 발행 버튼 에러 무시**
- 실패해도 아무 표시 없음 → alert() 에러 메시지 추가

### 🟠 직접 발행 처리
- 강동헤리티지자이 66점 → blog_posts INSERT + blog_post_id 연결
- 외식가맹점 40점 → blog_posts INSERT + blog_post_id 연결
- 구영테크 blog_post_id 연결

### 🟠 이메일 트래킹 대시보드
- DB: email_send_logs에 opened_at, clicked_at, open_count, click_count, clicked_url, subject 추가
- API: POST /api/webhook/resend (email.opened/clicked/delivered/bounced/complained)
- RPC: increment_email_open, increment_email_click
- UI: EmailDashboard 전면 개편 — 오픈율/클릭율 KPI, 캠페인 통계 탭, 발송 이력 탭 (열람/클릭 배지)
- **⚠️ Resend 웹훅 등록 필요**: https://resend.com/webhooks → kadeora.app/api/webhook/resend

### 🟡 블로그 품질 개선
- cover_image 7,620건 OG API로 교체 (Unsplash 중복 83.5% → 0%)
- font-size:10/11px → 12px 일괄 수정
- grid-template-columns:1fr 1fr → repeat(auto-fit,minmax(140px,1fr)) 모바일 대응
- sanitizeHtml: position:fixed, display:none, user-select:none, pointer-events:none 제거

### 🟡 이슈 자동발행 오늘 실적
- issue-draft 크론 오늘 12건 자동 발행 (한솔테크닉스, 청약30대, 유가/부동산 등)
- 40점↑ 미처리 이슈 6건 크론 순차 처리 중

## 현재 미완료 (PENDING)
- Resend 웹훅 등록: https://resend.com/webhooks
- Resend 도메인 인증: kadeora.app DNS 레코드 (4건 실패 원인)

## Architecture Rules (불변)
- 포인트: award_points/deduct_points RPC만
- 블로그 INSERT: safeBlogInsert만
- CSP: middleware.ts에만
- 크론: 에러 시 200 반환
- OG 폰트: Node.js fs.readFileSync
- Supabase RPC: try/await (.catch() 금지)
- STATUS.md: 세션마다 업데이트 후 커밋
- git push 전 git pull origin main --rebase 필수
- blog_post_id: bigint (blog_posts.id 타입과 일치)
- issue-draft/issue-manual: validate_blog_post NO_MAP 면제
