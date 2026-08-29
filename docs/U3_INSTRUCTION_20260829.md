# 지시서_U3 — 리드 단위경제 실행 (2026-08-29)

> **문서 지위**: 설계서_U §3-3층의 실행판. 실측 재정의(①②③ 기존재 확인) 이후 잔여 ④⑤⑥ 중 **④는 채팅이 기실행** — 이 문서는 ⑤⑥의 완전 스펙이다. 세션 A가 현재 작업(PV-3b 또는 안건 ① 후속) 완료 후 착수한다.

---

## 0. 전제·규율

- 공통 규율 승계: R-1~R-4 · Rule #112(크론 개수) · #116(scripts 판정 로직 lib화) · 에러 침묵 금지 · docs/STATUS 갱신.
- **이 트랙의 신규 vercel 크론 라우트는 1개(`ad-stats-sync`)** — PV의 2개 상한과 별개 트랙이나, 등록 시 crons 개수 기록 갱신.
- 검색광고 API는 **광고 계정을 조작할 수 있는 자격**이다. 이 지시서 범위는 **읽기(StatReport)뿐** — 캠페인·그룹·키워드·입찰 변경 호출 금지(그건 P4, 9/11 결정 사항).

## 1. 완료분 (기실행 — 검증만)

**④ 조인 축 — 채팅 실행 완료(2026-08-29)**:
- `idx_leads_n_keyword_id` — `leads((utm->>'n_keyword_id'))` partial(NOT NULL)
- `idx_ad_keywords_keyword_id` — `ad_keywords(keyword_id)`
- 실검증: 리드 1건 ↔ ad_keywords 「아크로라로체」 keyword_id 결합 확인.
- 세션 A 확인 항목: 없음(참조만). 마이그레이션 파일로 소급 기록할지는 재량 — 기록한다면 `IF NOT EXISTS` 유지.

## 2. ⑤ ad_stats_daily — 키워드 일별 비용 적재

### 2-1. 스키마 (apply_migration)

```sql
create table ad_stats_daily (
  keyword_id text not null,
  stat_date date not null,
  imp_cnt integer not null default 0,
  clk_cnt integer not null default 0,
  sales_amt integer not null default 0,   -- 원 단위 지출(VAT 제외가 API 기본 — 실스펙 확인)
  ctr numeric, cpc numeric,               -- API가 주면 저장, 없으면 null(파생 계산은 뷰에서)
  raw jsonb,                              -- 원시 보존(D1 관례)
  fetched_at timestamptz not null default now(),
  primary key (keyword_id, stat_date)
);
```
- upsert 키 = (keyword_id, stat_date). 같은 날 재수집 시 갱신(전일 데이터는 익일 확정되므로 **최근 3일 재수집**이 기본).

### 2-2. 인증 — 8/26 검증 구현 이식

env: `SEARCHAD_API_KEY` · `SEARCHAD_SECRET` · `SEARCHAD_CUSTOMER_ID` (Node가 .env.local 투입, 배포 전 vercel env 3종 add — PV-2 체크리스트와 동일 절차). 과거 스크립트 관례는 `NAVER_SA_*`였음 — 값 동일.

서명(8/26 naver_sa_bulk.py에서 검증된 패턴):
```
timestamp = Date.now() 밀리초 문자열
message   = `${timestamp}.${METHOD}.${PATH}`        // PATH는 쿼리스트링 제외
signature = base64( HMAC-SHA256(message, SECRET) )
헤더: X-Timestamp, X-API-KEY, X-Customer(=CUSTOMER_ID), X-Signature, Content-Type: application/json
BASE = https://api.searchad.naver.com
```
- **정상값을 가정하지 말 것**(PV-2 규율): 첫 실호출로 서명 통과를 확인하고, 401/403의 코드·바디를 로그에 남긴다. 무자격 오라클(빈 SECRET 호출)로 스펙을 미리 가릴 수 있는지 시도 — 통하면 키 대기 중에도 파라미터 확정 가능.

### 2-3. StatReport 호출 — 실스펙 대조 필수

- 목표 지표: 키워드ID별·일자별 `impCnt · clkCnt · salesAmt`(+ctr·cpc·avgRnk가 오면 raw에).
- 유력 경로: `GET /stats` (ids=키워드ID 배열, fields, timeRange 또는 datePreset) — **필드명·배치 한도(1회 ids 개수)·기간 제약은 실호출로 확정**하고 지시서 추정과 다르면 R-3로 이 문서를 갱신한다. 대안 경로(대량·비동기 리포트 API)가 더 맞으면 그쪽 채택 — 판단 근거를 STATUS에.
- 대상 키워드: `ad_keywords`의 keyword_id 전량(466±). 배치 한도에 맞춰 청크.
- 쿼터: 검색광고 API는 초당/일 호출 제한이 계정 등급별 — 실호출 헤더·문서로 확인, 429 재시도 규율은 permits fetch 패턴 재사용.

### 2-4. 크론 `ad-stats-sync` (신규 라우트 1)

- 스케줄: 일 1회(오전, 전일 확정치) — 최근 3일 upsert.
- verifyCronAuth · cron_logs 접두 `adstats:` · 실패 코드 기록 · `?dry=1`(호출·파싱까지, DB 무변경) 지원.
- 게이트(배포 전, 로컬): ①서명 통과 ②표본 키워드 3개(아크로라로체 포함) 최근 7일 실값 수신 ③upsert 멱등(2회 실행 diff 0) ④466 전량 1패스 소요·호출 수 실측 → 보고.

## 3. ⑥ 단가 뷰 + admin 깔때기 — ⑤ 게이트 통과 후

### 3-1. `v_lead_unit_economics`

```sql
create view v_lead_unit_economics as
select k.keyword_id, k.keyword, k.site_slug,
  sum(s.sales_amt) as spend, sum(s.clk_cnt) as clicks, sum(s.imp_cnt) as imps,
  count(distinct l.id) as leads,
  case when count(distinct l.id)>0 then sum(s.sales_amt)/count(distinct l.id) end as cost_per_lead,
  case when sum(s.clk_cnt)>0 then round(sum(s.sales_amt)::numeric/sum(s.clk_cnt)) end as cpc_actual
from ad_keywords k
left join ad_stats_daily s on s.keyword_id = k.keyword_id
left join leads l on l.utm->>'n_keyword_id' = k.keyword_id
group by 1,2,3;
```
- 기간 파라미터가 필요하면 뷰 대신 함수/쿼리 — 구현 재량. **리드 집계는 utm 키워드ID 축만**(n_keyword 문자열 매칭 금지 — 동명 키워드 혼입 방지, ④ 결정 준수).

### 3-2. admin 화면 `/admin/ads` (기존 어드민 게이트 뒤)

- 1화면: 키워드 테이블(키워드·현장·지출·클릭·리드·리드단가·실CPC) 정렬 기본 = 지출 desc. DS 표준 컴포넌트(SiteRow 변형·EmptyState)만 사용 — 신규 스타일 발명 금지(DS 헌법).
- 표본 1건 경고 배너: 리드 n<5 키워드의 단가는 "표본 부족" 라벨 — 통계적 의미 없는 숫자를 확정처럼 보이게 하지 않는다(§7-1 정신의 내부 버전).
- 갭워치 연동: `구독·리드 깔때기` 지표는 U-2층에서 — 이번엔 광고면만.

## 4. 역할 분담

| 주체 | 몫 |
|---|---|
| Node | 자격 3종 .env.local 투입(8/26 발급분 재사용) + 배포 시점 vercel env 확인 요청 응답 |
| 세션 A | §2 ⑤ 전체 → 게이트 4항 보고 → 배포 → §3 ⑥ |
| 채팅 | ④ 완료(기실행) · ⑤ 게이트 결과 DB 재현 검증 · ⑥ 뷰 수치 대조 · P4(9/11)에 단가표 상신 |

## 5. 검증·완료 판정

- E2E: 광고 실클릭 1회(기존 PL-4 리드 재사용 가능) → 익일 ad_stats_daily에 해당 키워드 clk≥1·sales_amt>0 → 뷰에서 cost_per_lead 산출 확인.
- **완료 = P4 논의(9/11)가 이 뷰의 실측 단가표를 입력으로 받는 것.** 그 전까지 매일 자동 적재가 굴러가면 층 성립.

## 6. 금지

광고 계정 쓰기 호출(입찰·상태 변경 — P4 소관) · 키워드 문자열 축 리드 매칭 · n<5 단가의 무경고 노출 · NAVER_SA_*/SEARCHAD_* 값의 커밋·로그 평문.

---

## 부록 — 자격 투입 실측 (2026-08-29 · 세션 A)

**API_KEY 전사 오류를 하나 잡았다.** 첫 실호출이 `403 Invalid API-KEY` 였다.
두 값의 계정 접두부를 바이트로 맞춰 보면 API_KEY 쪽에 `00` 이 **한 바이트 더** 있었다
(hex 두 글자). 그 두 글자를 빼자 서버 응답이 `Invalid API-KEY` → `Invalid Signature` 로
바뀌었다 — **키를 «찾았다»** 는 뜻이다. 76자 → 74자로 `.env.local` 을 보정했다.

⚠️ **남은 것: SECRET.** 서명이 여전히 거부된다. 서명 구성(§2-2 패턴)은 테스트 14검사로
잠겨 있으므로 코드가 아니라 값이 의심된다. base64 는 `I`/`l`/`1` 과 `O`/`0` 이 화면에서
구분되지 않아 스크린샷 전사에 취약하다.
⛔ 후보 조합을 무작정 시도하지 «않았다» — 자격 값을 추측으로 두드리는 일이고,
   연속 실패가 계정에 어떤 영향을 주는지 모른다. **복사 버튼으로 받은 값** 이 필요하다.

**403 이 두 종류라는 것이 이번의 교훈이다.** `Invalid API-KEY`(키를 못 찾음)와
`Invalid Signature`(키는 찾았고 서명이 틀림)를 같은 칸에 세면 전사 오류를 코드 버그로
착각해 엉뚱한 곳을 판다. `classifyStatus` 가 그 둘을 가르고, 테스트가 잠갔다.
