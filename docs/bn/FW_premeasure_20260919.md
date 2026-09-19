# FW 사전 실측 — 적재 경로·이벤트 훅 지점 (CC, 2026-09-19)

판정회신_BN-2 §5 골자에 대한 CC 사전 실측. 설계가 아니라 «지금 무엇이 있고 무엇이 없는가».

## 1. 유입 실측 — 뉴스는 부동산 글을 거의 못 만든다 (14일)

| source_type | category | 글감 | 초안 | 주 종결 |
|---|---|---|---|---|
| news_rss | stock | 515 | 135 (26%) | — |
| news_rss | apt | 152 | **5 (3%)** | **no_entity 145**(현장 매칭 실패 → LB 게이트) |
| apt_source_diff | apt | 152 | **0** | below_threshold 152 |
| dart_filing | stock | 102 | 10 | |
| bp70_hub | apt | 39 | 18 | |
| cvn_name_event | apt | 22 | 3 | |
| bn_hub | apt | 10 | 2 | (크레딧 소진) |

→ 결함은 «주식 유입 과다» 와 «부동산 뉴스 전환 불능» 두 겹이다. 소스단 8:2 재가중은 주식을 줄일 뿐 부동산을 늘리지 못한다
(부동산 뉴스 95%가 특정 현장을 못 가리켜 버려진다). **부동산 물량은 현장 기점 적재(BP·BN 방식)로만 나온다.**

## 2. 현장 기점 생산자 — 레일은 있고 «부르는 자» 가 없다

- 적재→생성 레일: `issue_alerts(apt_site_id, raw_data 규격)` → issue-draft → safeBlogInsert. hub 고정·hold(review-hold.ts)·스캔2·단지명 병기까지 BN 에서 갖춰짐.
- 기존 현장 기점 생산자 `issue-preempt`(Phase1 청약 신규 · Phase2 미커버 현장 · Phase3 DataLab · Phase4 시공사 분양예정)는
  **2026-08-27 b96c7ff6(A1)에서 의도적으로 등록 해제**. 마지막 실행 8/27, 글감 마지막 8/26.
  8월 실적: apt_sites_gap 571건 중 ai_failed 364 · auto 15. 8/24 preempt 초안(무관 푸터·옛 시공사)이 이 Phase 2 산출.
  ⛔ 그대로 되살리지 말 것 — 무작위 미커버 선정·summary 에 세대수·시공사를 날것으로 싣는 구조가 결함형 그 자체다.
- 현재 스케줄된 현장 기점 생산자 = **cvn-name-watch(이름 사건, 일 1회)뿐**. BP·BN 은 사람이 SQL 로 적재.
- 판정 필요: 「신규 크론 0」 하에서 FW 생산자를 어디에 둘지 —
  (a) issue-preempt 라우트를 FW 생산자로 재작성 후 재등록(해제된 슬롯 복원 — 신규 크론인가?)
  (b) 기존 일 크론 말미 훅 — 단계 전환은 sync-apt-sites(`sync_redev_lifecycle` 호출부 src/app/api/cron/sync-apt-sites/route.ts:524) 직후,
      입주·분양예정 회전은 batch-poll 팬아웃 형제로(스케줄 추가 없음)
  (c) pg_cron SQL 생산자(스케줄 1 추가)

## 3. 축별 저수지·훅 지점

| 축 | 저수지(활성) | 훅 지점 | 실측 주의 |
|---|---|---|---|
| ① 분양예정 | expected_sale_sort 2026~2030 52 (세션 A) | BP70 레일(기존) | bp.hub_publish_enabled=true — 무판독 발행 중 |
| ② 정비 단계 전환 | 부울경 정비 284 | 트리거 `trg_apt_site_stage_change` → apt_site_events(stage_change). 코드 훅은 sync-apt-sites:524 직후 | **유기 전환 희박**: 9/14 292건은 1회 백필(`backfill:redev:*` 접두), 이후 정상 회전 전환 **9/16 1건**. 청약 유래(derived_subscription) 30건/7일. → 이벤트 단독이면 주 1~2편. 284곳 커버는 «단계별 정기 회전» 이 본체, 이벤트는 가속기. 훅은 `source NOT LIKE 'backfill:%'` 필터 필수 |
| ③ 입주장 | move_in_date 2026~2030 **963 · 부울경 157** | 없음(신설 축) — 입주 글감 생산자 0 | move_in_date 는 **text YYYYMM**(월 정밀도) → D-90/D-30 은 «입주 예정 월» 문형으로만. 일 단위 D-day 단정 금지 |
| ④ 청약 일정 | 청약 연결 현장 중 공고~발표 단계 19 | issue-preempt Phase1(해제됨) | apt_subscription 글감 마지막 8/22 |

## 4. 품질 전제(BN 에서 확인된 것 — FW 에 그대로 승계)

- 현장 블록 세대수는 units_conflict 미해소면 무기재(6c33fe04). FW 물량 확대 전 conflicting 검수 큐가 커질 것 — 세션 A 처리량이 병목 후보.
- 스캔2 는 BN 글감만 강제, 그 밖 부동산 글감은 섀도 기록(`raw_data.scan2`). FW 착수 전 섀도 1~2주 분포로 강제 범위 판정 권장.
- 실거래 집계는 «시군구 전체» 뿐(현장 단위 아님) — 입주장 「시세·전세 흐름」 시리즈는 단지 단위 데이터가 없으면 시군구 집계 문형으로 한정.
