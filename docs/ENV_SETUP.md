# 환경변수 가이드 — 카더라

> Vercel Dashboard > Settings > Environment Variables 에서 관리.
> Production / Preview / Development 3개 환경 각각 설정 가능.

## 필수 (이미 세팅됨)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `ANTHROPIC_API_KEY`
- `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET`
- `SOLAPI_API_KEY` / `SOLAPI_API_SECRET` / `KAKAO_CHANNEL_ID` / `SOLAPI_SENDER_PHONE`
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_ORG` / `SENTRY_PROJECT`
- `TOSS_SECRET_KEY` / `NEXT_PUBLIC_TOSS_CLIENT_KEY`
- `INDEXNOW_KEY`

## 세션 139 신규

### `NODE_NOTIFY_PHONE`
- **용도**: Big Event 자동 파이프라인에서 Node에게 Solapi 알림톡 발송 시 수신 번호
- **형식**: 국제 형식 `+82-10-XXXX-XXXX` 또는 국내 `010-XXXX-XXXX` (함수 내부에서 숫자만 추출)
- **환경**: Production 필수 / Preview·Development 선택
- **사용 라우트**:
  - `/api/cron/big-event-news-detect` (중요 뉴스)
  - `/api/cron/big-event-auto-pillar-draft` (Pillar draft)
  - `/api/cron/subscription-prebrief-generator` (D-30/7/1 draft)
- **없으면**: 알림 발송만 skip, 나머지 처리(로그·DB insert)는 정상 진행

### Solapi 템플릿 ID (4종 — 심사 통과 후 주입)
- `SOLAPI_TEMPLATE_BIG_EVENT_NEWS` — big_event 주요 뉴스
- `SOLAPI_TEMPLATE_DRAFT_READY` — draft 검수 대기
- `SOLAPI_TEMPLATE_STAGE_TRANSITION` — 단계 전환
- `SOLAPI_TEMPLATE_FACT_ALERT` — 팩트 신뢰도 급락

> 심사 절차: `docs/SOLAPI_TEMPLATES.md` 참고. 심사 통과 전에는 env 미설정 상태 유지 → 라우트 측에서 자동 skip.

## GSC (세션 139 [GSC-STUB])

### `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
- Google Cloud Console > API 및 서비스 > 사용자 인증 정보 > OAuth 2.0 클라이언트
- 승인된 리디렉션 URI: `https://kadeora.app/api/admin/gsc/oauth`
- Node 계정(kadeora.app@gmail.com)에서 kadeora.app 속성 소유권 확인 필요

### `GSC_SITE_URL`
- 기본값: `https://kadeora.app/`
- Search Console 속성 등록 URL과 동일

### `GSC_REFRESH_TOKEN`
- OAuth 최초 승인 후 자동 저장 (DB `oauth_tokens` 테이블 권장, env는 fallback)
- `docs/GSC_SETUP.md` 참고

## 환경별 차이
| Key | Prod | Preview | Dev |
|---|---|---|---|
| `CRON_SECRET` | 강함 고정 | 랜덤 | 랜덤 |
| `NODE_NOTIFY_PHONE` | 실제 번호 | 테스트 번호(선택) | 빈 값 |
| `GSC_*` | 본 계정 | 본 계정 | 본 계정 |
| `TOSS_SECRET_KEY` | 실결제 키 | 테스트 키 | 테스트 키 |

## 변경 후 배포 절차
1. Vercel Dashboard에서 env 변경
2. 관련 환경에서 재배포 (`vercel redeploy`)
3. 로컬 개발의 경우 `.env.local` 파일에만 추가 (커밋 금지)
