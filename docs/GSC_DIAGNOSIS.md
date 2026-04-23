# GSC 진단 — 세션 153

## 현황 (2026-04-23)
- `gsc_search_analytics` 테이블 rows: **0**
- pg_cron `gsc-sync-daily`: 등록 완료, 스케줄 `0 19 * * *` (KST 04:00)

## 원인 확정 — 코드 버그
**`/api/cron/gsc-sync/route.ts`** 에서 oauth_tokens 조회 시 컬럼명 오류.
- route 코드: `.eq('service', 'gsc')`
- 실제 컬럼: `provider` (DB 스키마 실측)

→ 크론이 실행돼도 `no_gsc_refresh_token` 반환 후 조기 종료. DB insert 0건.

## DB 상태 (oauth_tokens 실측)
```
provider: gsc
refresh_token: SET (103 chars)
access_token: SET
refresh_count: 0
last_refreshed_at: 2026-04-19 02:56
last_error: null
client_id + client_secret: 모두 SET (DB에 저장)
```

## 수정 (Session 153 commit)
- `.eq('service', 'gsc')` → `.eq('provider', 'gsc')`
- client_id/secret env 값 우선, 없으면 oauth_tokens 행의 값 fallback
- 배포 후 내일 04:00 KST pg_cron 첫 자동 실행 → gsc_search_analytics 적재 확인

## 즉시 수동 트리거 (배포 후)
```sql
-- pg_net 로 바로 호출
SELECT public._call_vercel_cron('/api/cron/gsc-sync');
SELECT pg_sleep(5);
SELECT * FROM cron_logs WHERE cron_name LIKE '%gsc%' ORDER BY started_at DESC LIMIT 3;
```

## 검증 쿼리
```sql
-- 적재 확인
SELECT date, COUNT(*) rows, SUM(clicks) clicks, SUM(impressions) impressions
FROM gsc_search_analytics GROUP BY date ORDER BY date DESC LIMIT 7;
```

## 남은 리스크
- refresh_token 이 2026-04-19 발급분 — Google OAuth refresh_token 만료 기간: 6개월 방치 시. 약 5개월 유효
- scope 부족 가능성: Webmasters v3 API 는 `https://www.googleapis.com/auth/webmasters.readonly` 필요
  - 현재 `oauth_tokens.metadata` 에 scope 기록 여부 확인 필요
