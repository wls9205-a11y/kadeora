# Google Search Console OAuth 연동 가이드

> 세션 139 [GSC-STUB] 작성 · Node 수동 단계.
> 목적: GSC 쿼리 데이터를 카더라 DB로 pull 받아 블로그 성과 모니터링.

## 1. Google Cloud Console 준비

### 프로젝트 선택
- Google Cloud Console > 프로젝트 선택 또는 신규 생성
- Project ID 기록 (env에는 필요 없으나 관리 용도)

### API 활성화
- APIs & Services > Enabled APIs > **"Google Search Console API"** 사용 설정

### OAuth 동의 화면
- User Type: **Internal** (Workspace 계정) 또는 **External**
- 앱 이름: `카더라 GSC 연동`
- 사용자 지원 이메일: Node 이메일
- 승인된 도메인: `kadeora.app`
- 스코프: `https://www.googleapis.com/auth/webmasters.readonly`
- 테스트 사용자 (External인 경우): Node 이메일 추가

### OAuth 2.0 클라이언트 ID
- 애플리케이션 유형: **웹 애플리케이션**
- 이름: `Kadeora GSC`
- 승인된 JavaScript 원본: `https://kadeora.app`
- **승인된 리디렉션 URI**: `https://kadeora.app/api/admin/gsc/oauth`
- 생성 후 `client_id` / `client_secret` 복사

## 2. Vercel 환경변수 설정

Vercel Dashboard > Project > Settings > Environment Variables:

```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GSC_SITE_URL=https://kadeora.app/
```

Production 환경에 설정 후 **재배포**.

## 3. Search Console 속성 권한

- https://search.google.com/search-console 접속
- `https://kadeora.app/` 속성의 **소유자** 또는 **완전한 사용자** 권한이 있는 계정으로 로그인
- Node 계정이면 충분. 별도 조치 불필요.

## 4. 최초 OAuth 승인

1. 관리자 계정으로 로그인한 상태에서 브라우저로:
   ```
   https://kadeora.app/api/admin/gsc/oauth
   ```
2. Google 계정 선택 → 권한 허용 → 자동으로 `/admin?gsc=connected`로 리다이렉트
3. 백엔드에서 `public.oauth_tokens` (provider='gsc')에 토큰 저장

### 상태 확인
```
GET https://kadeora.app/api/admin/gsc/oauth?status=1
→ { ok: true, has_token: true }
```

## 5. 토큰 라이프사이클

- `access_token`: 1시간 유효. `src/lib/gsc-client.ts → getValidAccessToken()`이 10분 여유 이하이면 자동 refresh.
- `refresh_token`: 장기 유효 (재로그인 전까지). 오류 시 초기 승인 절차 재실행.
- `last_refreshed_at`, `refresh_count`로 갱신 이력 추적.

## 6. 샘플 쿼리 (세션 140+에서 크론 전환)

```ts
import { fetchSamikBeachQuery } from '@/lib/gsc-client';
const data = await fetchSamikBeachQuery();
// { rows: [{ keys: [page, query], clicks, impressions, ctr, position }, ...] }
```

## 7. 장애 대응

| 증상 | 원인 | 대응 |
|---|---|---|
| `status 401` | access_token 만료 | getValidAccessToken()이 자동 refresh, 실패 시 재승인 |
| `status 403` | 속성 권한 없음 | GSC에서 Node 계정에 완전한 사용자 권한 부여 |
| `no valid token` | DB 레코드 없음 | 최초 승인 절차 재실행 |
| refresh 실패 | refresh_token 무효 | Google Cloud Console에서 client secret 재생성 후 재승인 |

## 8. 다음 단계 (세션 140+)

- `/api/cron/gsc-daily-pull`: 일 1회 pull, samik-beach + 기타 killer URL 쿼리 집계
- `gsc_query_stats` 테이블 신설 (date, page, query, clicks, impressions, position)
- 관리자 대시보드에 CTR·position 그래프 추가
- 감쇠 키워드 감지 → blog-rewrite 재작성 큐 투입
