# BN CC 회신 — C1·C2·C4·C6·C7 + §5 사전 실측 (2026-09-18)

HEAD 착수 280e39d2 · 수리 커밋 3809d1ba. 세션 A 집행분(S1·§1-4·§2·§3-B)은 **미집행 상태 확인**(site_name_candidates `manual:sessionA-20260918` 0행).

## C1 §3-A 링커 — 원인 확정 · 수리 배포

- **H1(감만1 「부산」「재개발」 부분매칭) 기각. H2도 아님** — 매칭 자체가 없다.
  `appendRelatedHubFooter`(src/lib/internal-link-injector.ts)가 `apt_sites` 를 **정렬 없이** 받아 `slice(0,2)`(apt 는 3) 를
  카테고리 무관 모든 issue-draft/issue_preempt 글 말미 「## 관련 정보」에 붙였다. 물리 저장 순서 첫 행 = 무관 현장. 행이 갱신되면 첫 행이 바뀌어 날짜별로 slug 가 몰린다(반여4 8/31 · 우암1 9/1~14 …).
- `blog_site_links` 는 본문 `/apt/<slug>` 추출(recordSiteLinks)이라 푸터 링크가 그대로 대장에 들어갔다.
- **규모(§0 의 「반여4 9·감만1 1」보다 훨씬 큼)**:
  - V3 원문(재개발·재건축 slug + 제목 필터): 18 slug · 381행
  - **V3′(푸터에만 존재하는 링크 행)**: **2,667행 · 1,079편 · 206 slug** (비apt 990 · apt 1,677 · 발행글 755)
  - 비apt 글 현장 링크 993행 중 990행이 푸터산, 인라인(injectInternalLinks) 3행.
- **파생 결함 2 (BN 범위 밖 — 판정 요청)**:
  1. **hub 오염 184편(발행 100)** — safeBlogInsert 가 「본문 첫 리드 가능 링크」로 hub 를 자동 승격해 푸터 현장이 `hub_apt_slug` 가 됐다 → 리드폼이 무관 현장으로 연결.
  2. **§2-2 게이트 무력화** — 최근 60일 apt 이슈글 641편 중 381편이 현장 링크를 푸터에서만 얻어 통과.
- **수리(3809d1ba, 완화 없음)**: 푸터 현장 = 글감 현장(`issue.apt_site_id`) + 본문에 이미 걸린 `/apt/<slug>` 중 활성 실존만. 없으면 현장 링크 없이 카테고리 랜딩만. 임의 `/apt/redev/<id>` 도 제거.
  의도된 부작용: 현장 없는 apt 이슈 초안은 이제 §2-2 게이트에서 `no_site_link` 로 멈춘다(60일 기준 381편 규모 — 발행분은 47편).
  테스트 related-footer.test.ts 신설, 전체 86파일·1,591건 통과.

### §3-B 삭제 대상 정의(세션 A — 백업 SELECT 선행, 행만 삭제·본문 무수정)

```sql
-- V3′ 백업/대상 (DELETE 는 같은 조건 USING 으로)
SELECT l.blog_id, l.site_slug FROM blog_site_links l JOIN blog_posts b ON b.id=l.blog_id
WHERE b.cron_type IN ('issue-draft','issue_preempt')
  AND strpos(b.content, E'\n## 관련 정보\n\n- [') > 0
  AND strpos(b.content, '/apt/'||l.site_slug) > strpos(b.content, E'\n## 관련 정보\n\n- [');
-- 기대 2,667행. 게이트 4 는 V3 가 아니라 이 조건 0행으로 판정할 것.
```
⚠️ 발행글 본문의 푸터 링크 자체는 남는다(본문 수정 금지). 대장·집계만 정화된다.

## C2 §4-1 preempt 5편 — 발행 불가 판정 · 사유 기록 완료

- false 사유: 자격식 `score≥65 ∧ seo_tier∈{S,A,restore_candidate} ∧ len≥2500` 에서 **seo_tier='unscored'**. 미발행 티어 채점은 이미지 백필 큐를 탄 글만 대상(3만 편 일괄 발행 방지)이라 영구 미승격. 정책 hold·할루 hold 아님(할루 감사 CSV 미포함).
- 그러나 **5편 모두 본문에 무관 푸터**(서울 기축 번동한양아파트·잠실엘스·SM해그린) + 111439 는 비활성 slug `촉진4구역-재개발` 링크. 발행하려면 본문 수정이 필요 → §4-1 규정대로 **발행하지 않고 §5 신규 생성으로 대체**.
- 기록: `auto_unpublished_reason='hold:bn_20260918_footer_contam_replace_by_new'` 5/5(RETURNING 확인, 가드 트리거상 재공개 불가). 111439 촉진4 는 BP70 관할(§7) — BPNR 로 이관.
- Node `!`② 기본안(그대로 발행)은 전제가 깨져 **집행하지 않음**.

## C4 근거 채집 (웹 실측 — 세션 A 가 S1 에 source_url·tier 로 반영)

| slug | 단지명 | 시공사 | URL | 판정 |
|---|---|---|---|---|
| 대연8-재개발 | 더샵 원트레체 | 포스코이앤씨 | econovill.com idxno=412196 (2020) | T-B 가능 |
| 감천2-재개발 | 힐스테이트 오션스카이 | 현대건설 | safetynews.co.kr idxno=225866 (2023-11) | T-B 가능 |
| 광안5-재개발 | 광안자이 인피니원(나무위키만) | **GS건설**(2026-04-26 선정) | digitaltoday.co.kr idxno=660552 | 시공사만 — 명칭 T-C 유지 |
| 괴정5-시범생활권-재개발 | 힐스테이트 푸르지오 사하역 포레스트 | **현대건설·대우건설 컨소시엄**(55:45, 1조3,086억) | busan.com code=2024091018030403561 (CC 원문 확인) + news1.kr/realestate/general/5536932 · 해지: busan.com code=2024020618124311983 | **2소스 교차 성립 → builder 정정** |
| 괴정7-재개발 | 스페디움 세븐(나무위키만) | SK에코플랜트 60%·현대건설 | khan.co.kr 202301160700001 · news.skecoplant.com/sk-ecoplant/8691 | 시공사 2소스 / 명칭 미확인 |
| 범천4-재개발 | 힐스테이트 르네센트 | 현대건설 | hdec.kr press CompanyPressSeq=88 | T-B 가능 |
| 부곡2-재개발 | 자이 더 센터니티 | GS건설 | ikld.kr idxno=255662 | T-B 가능 |
| 사직1-5-재건축 | 사직 SK뷰 라 테라(나무위키만) | SK에코플랜트 | arunews.com idxno=42102 | 시공사만 |
| 사직2-재개발 | 래미안 사직 엘라티오 | 삼성물산 | news.mt.co.kr no=2024082510471112762 | T-B 가능 |
| 사직3-재개발 | 사직역자이 엘리스트(나무위키만) | **GS건설 단독** | ajunews.com 20260807173907679 | 시공사만 |
| 사직5-재개발 | 힐스테이트 사직 더프리즘 | 현대건설 | sisaon.co.kr idxno=177315 | T-B 가능 |
| 부산-감만1-재개발 | 감만 푸르지오 센트레빌(나무위키만) | 대우건설 70%·**동부건설** 30% | centreville.co.kr brand/news_view?seq=200 | 시공사 확인(DB 값 일치) |
| 김해-외동-재건축사업 | 김해 드메인 데시앙(부산일보만) | 태영건설 | busan.com code=2024053012042103267 · desian.co.kr/web/complex/preSale | **태영 공식 페이지에 사업은 있으나 「드메인 데시앙」 명칭 없음 → dn 승격 조건 미충족, 별칭에서 정지** |
| 중동5-재개발 | 아크로 해운대 | DL이앤씨 단독 | hankyung.com 202307246850i | builder 기입 가능 |
| 수영1-재개발 | 센텀자이 리버노블(제안명) | GS건설 | busan.com code=2025012018222125859 · asiae 2026091014131154505(도급 공시) · leadeconomy idxno=9658 | CC 검색 확인 |
| 사직4-재개발 | 푸르지오 그라니엘 | 대우건설(2026-01-17 선정, 7,923억) | etoday.co.kr/news/view/2546836 · busan.com code=2026012018132997803 | **stage→constructor_selected 근거 성립** |
| 복산1-재개발 | (동래 자이 더 헤리티지 — 무효) | GS건설 **해지 결정 2026-07-07** | busan.com code=2026070818233610941 | 기존 별칭 「동래 자이」「동래그랑자이」 **제거 후보**(공식 의결 기사 미확인) |

- 1·6·7 번 출처는 2020~2022 수주 기사 — 이후 변경 기사는 찾지 못함.
- **§2-3 수영1 판정**: 별개 사업. 재개발(BARA…30128, 조합설립 2025-02) = GS·센텀자이 리버노블 / 재건축(BARA…0291, 추진위 2026-01) = 수영현대아파트. **병합 금지 · 정본 = 수영1-재개발**, §1 보류분 주입 대상.
- **§1-2 표 수정 필요**: 괴정5 builder 는 브랜드 역산 기대값(현대+대우)과 소스가 일치 — 「모순」은 DB 쪽이 폐기된 옛 시공사를 들고 있던 것.

## C6 §2 병합 레일

- 실물은 **308 이 아니라 301**(src/middleware.ts:175~, 의도적 — permanentRedirect 는 308 만 냄). 맵은 `scripts/gen-merged-slugs.mjs` 가 `apt_site_merges` 에서 생성하는 `src/lib/apt/merged-slugs.ts`.
- 승계는 수기 SQL 대신 **`merge_succession(dead, survivor, dry, run_id, exclude_aliases)`** 사용 권고 — 별칭 조각 필터(광역·「구역구역」 등) 내장. 순서: 승계 → merges 등재 → 301 맵 배포 READY → dead 비활성. dead 가 아직 활성일 때 맵을 만들려면 `--tsv` 경로(DB 모드는 활성 dead 를 뺀다).
- dead 착지 실측: `광안5구역-재개발` · `사직4구역-푸르지오-그라니엘` 각 링크 1(푸터산 가능) · hub 0 · 원장 0 → 유입 착지 아님, 301 은 위생 목적.
- **신규 이중 후보**: `부산-사직2-재건축`(site_planning, redev_key 수기형) vs `사직2-재개발`(BARA…30117) — 판정 큐 추가 요청.

## C7 §5-6 sa-sync 티어

- `tools/naver-sa/sa.py name_pool()` 은 `name_variants` 를 그대로 읽는다 — **티어 구분 없음**. 게다가 브랜드 별칭을 짧은순보다 **앞에 정렬**해 이번 T-C 별칭이 곧바로 1순위 키워드가 된다.
- sa-sync 자동 크론 없음(pg_cron·Vercel 0) — 회전은 수동 `sa.py apply --live`. → **S1 후 T-B 승격이 끝나기 전에는 부울경 회전 금지**. 위 C4 표에서 명칭까지 확인된 곳(대연8·감천2·괴정5·범천4·부곡2·사직2·사직5·사직4·수영1·중동5)만 T-B 승격 가능, 나머지(광안5·괴정7·사직1-5·사직3·감만1·김해외동)는 명칭 T-C 로 남으므로 **회전 시 해당 현장 보류**가 필요하다.

## §5 사전 실측

- 레일: `series-scheduled` 는 생성기 없는 공개 레일(pg_cron 160, publish_on 도래분 07시 KST 일괄). **BP 허브 레일(issue_alerts 적재 → issue-draft → safeBlogInsert, `apt_site_id` 로 hub 고정)** 이 생성+연결을 함께 하므로 권장. BN 용 source_type 를 따로 두면 BP 초안 hold(`bp.hub_publish_enabled`)를 타지 않고 곧장 자동 발행 경로로 간다 — BN-B 판독 전 첫 배치는 초안으로 멈출 장치를 먼저 정해야 한다(판정 요청).
- BP70 교차: **반여4-재건축은 BP70 글감 1건 보유 → BN 제외**(§5-1). 대상 21곳.
- price_source: 22곳 전부 NULL → 합성가 인용 위험 0(가격 무기재).
- 서금사5·6 slug = `서금사재정비촉진5구역-재개발`·`서금사재정비촉진6구역-재개발`, 광안A = `광안a-재개발`(DL이앤씨).

---

# BN CC 2차 회신 — BN-1 판정 선행 3건 · C5 첫 배치 · 부속 (2026-09-18 저녁)

## 선행 3건
1. **배포 확인**: 3809d1ba = `dpl_DswVzzno2wP5xhHcSB7vJPu3QacF` READY(production). 이후 d801620d `dpl_H4GUjUPLiWEE6Cei3TnCtZ59wGaB` · 25523b4e `dpl_By3PgLcYGQUo376Q8had1Ngh3sTQ` READY. 배포 후 V3′ 신규 0행.
2. **301 맵 DB모드 재생성**(d801620d): 465건(+2). 라이브 확인 — `/apt/광안5구역-재개발` → 301 `/apt/광안5-재개발`, `/apt/사직4구역-푸르지오-그라니엘` → 301 `/apt/사직4-재개발`.
3. **BN hold**(d801620d): `src/lib/content/review-hold.ts` — source_type `bn_hub` 는 `bn.hub_publish_enabled`(app_config, false 등록) 가 정확히 true 가 아니면 비공개 초안 + 생성 즉시 `auto_unpublished_reason='hold:bn_review'` 도장(DB 가드가 blog-auto-publish 경로까지 차단). BP 는 도장 없음(해제 절차 불변).
   ⚠️ 참고: `bp.hub_publish_enabled` 는 현재 **true** — BP 레일 글감은 판독 없이 곧장 발행된다. 그래서 C3 는 BP 레일이 아니라 BN hold 로 태웠다.
   **해제 절차(BN-B 통과 시)**: 스위치 true + 판독 통과 초안의 사유 `hold:bn_review` 를 비운다(가드는 사유만 본다).

## C5 첫 배치 (docs/bn/BN-B_batch1_20260918.sql, 글감 9)
- 대상: 사직2·사직4·사직5·부곡2·범천4·괴정5·수영1 (1순위·명칭 T-B) + 감천2(T-B, preempt 111426 대체) + **C3 촉진3(아크로 라로체, BP70 산입)**.
  1순위 중 광안5·사직3·사직1-5(T-C)·서금사5·6(명칭 근거 없음)은 2차.
- 규격: issue_type `redevelopment`(apt_redev 템플릿 — 선점형 청약전략 섹션 없음) · apt_site_id 로 hub 고정 · raw_data.complex_name/zone_label/title_spec(25523b4e — 현장 블록 병기 지시, 「제안 단지명」 문형) · source_urls 비움(아래 수치 불일치 때문) · 가격 무기재.
- **결과: 2/9 초안, 7/9 ai_failed**.
  - 112514 부곡2 · 112515 사직4 — `hold:bn_review` ✓ · 미발행 ✓ · hub 정확 ✓ · 푸터 = 자기 현장 1개 ✓ · blog_site_links = 자기 현장만 ✓.
  - **7건 실패 원인 = Anthropic API 크레딧 잔액 부족**(09:10Z~, Vercel 런타임 로그 원문 「Your credit balance is too low to access the Anthropic API」, llm_usage_logs `400:invalid_request_error`). BN 과 무관한 계정 공통 — 09:10 이후 **모든 LLM 생성 정지**. 충전 전 재큐잉은 재시도만 소진하므로 보류.
  - 충전 후 재큐잉 1문(CC 또는 세션 A):
    `update issue_alerts set publish_decision=null, fail_reason=null, retry_count=0, is_processed=false, processed_at=null where source_type='bn_hub' and publish_decision='ai_failed' returning id;`
- **사전 판독 표시(112514 부곡2 — BN-B 판독 입력)**: ① 「**최근 5년간** 중위 실거래가」 — 데이터 창은 2026-03~09(기간 왜곡) ② 「관리비 **평당 월 8,000~12,000원 대**」 — 데이터 블록에 없는 추정 수치(수치 게이트 통과했음 — 게이트 누수). 분양가 인용 0 · 제도 상수(예치금·취득세) 인용은 상수 블록 출처.
  제목은 규격(「단지명 — 구역명 … 총정리」)과 달리 「부산 금정구 부곡2구역 자이 더 센터니티 재개발 진행 현황」 — 병기는 충족, 형식 불일치.

## 부속
- **hub_cta_target**: 184편 전건 NULL — 잔존 없음. apt_site_id 보유 56편은 옛 hub 와 일치 0(푸터 기원 아님).
- **merge_succession() 수치 차단**(48f41bde · 마이그레이션 적용): total_units·complex_units → 「⛔ 자동 승계 제외 · 검수 큐」. 롤백 프로브로 검증(광안5 survivor 비움 → complex_units 검수 큐 2058/∅, 원복 확인). GRANT service_role 유지.
- **sa.py T-C 필터**(9662a033): 별칭이 그 현장 T-C 명칭의 부분 문자열이면 제외, T-B 갱신 시 자동 편입. 영향 6현장·22별칭(전부 BN) · BN 밖 0 · test_name_pool 전수 스윕(4,844) 통과. → §6 회전 금지는 코드로도 잠김.
- **사직2 이중 판정(CC 의견: 병합)**: 부산일보 2023-04-19 — 사직2구역은 **재개발**로만 존재, 그때 정비구역 지정 완료. `부산-사직2-재건축`(2026-03-24 생성, redev_stage 「정비구역지정」)은 같은 사건의 오분류 수기 레코드로 판단. 공공자료에 별도 「사직2 재건축」 없음. dead 착지: 링크 0·글 0·글감 0. → dead=`부산-사직2-재건축` / survivor=`사직2-재개발`, merge_succession(수치 자동 차단) · dead address 「부산 동래구 사직동」 은 검수 큐.
- **신규 결함 — 우동3 builder**: DB 「현대산업개발, 대우건설」 ↔ 실제 **현대건설 단독**(1.28조·2,503세대·「디에이치 아센테르」 제안 — 현대건설 뉴스룸 hdec.kr NewsSeq=645, 오피니언뉴스 idxno=73880). C3 아센테르 재생성은 세션 A builder 정정 후.
- **수치 불일치 2(세션 A 확인 요청)**: 괴정5 complex_units 3,509 ↔ 수주 기사 3,102세대+오피스텔 144실 / 촉진3 3,545 ↔ 기사 3,554.
- **사전 판독 표시(112515 사직4)**: 기계 점검(hold·hub·푸터·링크·단지명) 통과. 판독 결함 3 — ① 「최고가 15억 7,000만원(**강남동** 고급 단지)」 — 동래구에 강남동 없음, 괄호 귀속 창작 ② 「최저가 2,700만원(소형·낙후지역)」 수식어 창작 ③ 「본 기사는 분양가를 추정하거나 임의로 계산하지 않습니다」 류 **프롬프트 지시문 누출**. 분양가 수치 0(「미공개」 문형 준수).
  → 두 초안 공통: 실거래 집계 줄에 «해석 괄호·기간 수식어» 를 덧붙이는 패턴. 할루 스캔2 룰에 「실거래 최저·최고가 + 괄호 귀속」 검출 추가를 제안(세션 A 판정).

---

# BN CC 3차 회신 — BN-2 재개 · 게이트 5종 · 인라인 오링크 (2026-09-19)

## 배포
6c33fe04 스캔2 5종·세대수 무기재·301 사직2 · c130ba4c 인라인 링크 브랜드 단독 제외·앞쪽 경계 · 4e4bc584 스캔2 ① 오탐 수리·실거래 줄 인용 지시.
301 라이브: `/apt/부산-사직2-재건축` → `/apt/사직2-재개발` ✓.

## 재개 전 차단 2건
- 재큐잉 7건을 게이트 배포 전까지 정지(`fail_reason='bn_defer_gate5'`) — 괴정5·촉진3 은 현장 블록이 DB 세대수(3,509·3,545)를 그대로 싣는 구조였다. 배포 후 해제.
- 111402(우동3 preempt 초안, 8/24) — 사유 NULL 이라 같은 현장 중복 판정이 아센테르 글감을 막을 상황. 5편과 같은 결함(서울 기축 푸터 + 옛 시공사 「현대산업개발」) → `hold:bn_20260918_footer_contam_replace_by_new`.

## 세대수 무기재 규약(세션 A)
현장 블록은 `apt_site_events` 의 마지막 `units_conflict` 가 마지막 `units_conflict_closed` 보다 뒤면 세대수를 싣지 않는다. **해소 시 `units_conflict_closed` 이벤트 1행을 넣는다.**

## 첫 배치 판독 입력 (BN 초안 8 · 차단 2)

| id | 현장 | 스캔2(4e4bc584 재스캔) | 사유 | 비고 |
|---|---|---|---|---|
| 112514 | 부곡2 | 결함 3 — 「최근 5년간」·관리비 8,000~12,000원 | hold:bn_review:scan2 | 게이트 이전 생성 · 제목 구형 |
| 112515 | 사직4 | 결함 3 — 괄호 귀속 2(강남동·소형·낙후지역)·지시문 누출 | hold:bn_review:scan2 | 게이트 이전 · 제목 구형 |
| 112516 | 괴정5 | 0 · 제목 교정 | hold:bn_review | ⚠️ 본문 `[힐스테이트](/apt/힐스테이트)` 오링크(수리 전 생성) |
| 112517 | 사직2 | 0 · 제목 교정 | hold:bn_review | |
| 112518 | 촉진3(C3) | 결함 2 — 괄호 귀속(「소형 또는 노후 주택」·「대형 또는 강남…」) | hold:bn_review:scan2 | |
| 112519 | 감천2 | 0(① 오탐 3 해소) | hold:bn_review | ⚠️ `/apt/힐스테이트` 오링크 |
| 112520 | 사직5 | 0 | hold:bn_review | |
| 112521 | 범천4 | 결함 2 — 괄호 귀속 | hold:bn_review:scan2 | ⚠️ 「계약금은 분양가의 10~20%」 — ABG 계약금 규율 위반(스캔2 범위 밖, 판독 항목) |
| — | 수영1 | 수치 게이트 차단(추정 8억·7억 등) | — | 재큐잉 완료(개선 프롬프트) |
| — | 우동3(C3 아센테르) | 수치 게이트 차단(14만원·7억원) | — | 재큐잉 완료 |

- 결함형 재발: 괄호 귀속 창작이 5편 중 3편 → 게이트만으로는 재생성이 헛돈다. 4e4bc584 로 실거래 줄에 인용 지시를 넣었다(원인 차단). 결함분 재생성은 이 배포 이후가 효율적.
- 재생성 절차(세션 A 판독 후): 결함 초안 사유를 `hold:bn_regen_superseded` 로 바꾸고(같은 현장 중복 판정에서 «죽은 글» 이 된다) 그 글감을 `publish_decision=null, blog_post_id=null, is_processed=false, retry_count=0` 으로 되돌린다.

## 신규 결함 — 인라인 링크 부분일치 (§3 H2 실재)
- `injectInternalLinks` 가 단지명 속 브랜드를 «브랜드 단독 이름 현장» 으로 링크: 「힐스테이트 푸르지오 사하역 포레스트」 → 경기 이천 `/apt/힐스테이트`. c130ba4c 로 차단(브랜드 단독 이름 4현장 제외 + 앞쪽 경계).
- **과거분(세션 A 정리 대상)**: 브랜드 단독 slug 링크 34행(힐스테이트 28·아이파크 6 · 발행 2) · **hub 오염 12편**(힐스테이트 8·아이파크 4).
```sql
-- 링크 행 (백업 후 삭제)
SELECT l.blog_id, l.site_slug FROM blog_site_links l JOIN apt_sites s ON s.slug=l.site_slug
WHERE replace(s.name,' ','') IN (SELECT replace(brand,' ','') FROM brand_tokens WHERE is_active);
-- hub (결정① 과 같은 처분 후보)
SELECT b.id, b.hub_apt_slug, b.is_published FROM blog_posts b JOIN apt_sites s ON s.slug=b.hub_apt_slug
WHERE replace(s.name,' ','') IN (SELECT replace(brand,' ','') FROM brand_tokens WHERE is_active);
```
  ⚠️ 두 현장 자체(경기 이천 「힐스테이트」·「아이파크」)가 실제 단지라면 그 현장을 정당하게 가리킨 글이 섞였을 수 있다 — title_has(제목에 slug 포함) 힐스테이트 7·아이파크 1 은 판독 후 삭제.

## CV-N
실패 1회(9/18 21:10). 표적 선정이 결정적이고 분류 실패 URL 은 seen 대장에 남지 않아 다음 회전(9/19 21:10)이 자동 백캐치 — 소급 스캔 불요.

## FW
docs/bn/FW_premeasure_20260919.md — 부동산 뉴스 전환 3%(no_entity 95%) · 현장 기점 생산자 issue-preempt 는 8/27 A1 에서 의도적 해제 · 정비 유기 전환 주 1건 · 입주 축 생산자 0. 생산자 위치 판정 필요.

### 3차 추가 (재생성 2건 완결 · 수리 2)
- 622b2dae: 본문에 LLM 이 쓴 「## 관련 정보」가 있고 편집이 현장 링크 문장을 지우면 현장 링크 0 → §2-2 NO_APT_SITE_LINK(수영1·우동3 실측). 섹션이 있어도 글감 현장 링크가 없으면 섹션 머리 아래 1줄 보장. (BN 외 부동산 이슈 전반 적용)
- 6877d325: 현장 블록 실거래 줄에서 **최저·최고 제거**(중위·건수·기간만). 인용 지시(4e4bc584) 후에도 괄호 귀속 창작이 새 초안 6편 중 4편 — 원인 데이터를 뺐다.
- 112522 수영1(센텀자이 리버노블): 게이트 통과·hub ✓·링크 자기 현장만 · 스캔2 괄호 귀속 2 → hold:bn_review:scan2
- 112523 우동3(C3 디에이치 아센테르): hub ✓ · 시공사 현대건설 ✓(옛 오기 없음) · 세대수 무기재 ✓ · 스캔2 괄호 귀속 3 → hold:bn_review:scan2
- **첫 배치 10/10 초안 완비**: 깨끗 4(112516·112517·112519·112520 — 112516·112519 는 힐스테이트 오링크) · 결함 6(112514·112515·112518·112521·112522·112523, 전부 hold:bn_review:scan2).
  결함 6편 재생성은 6877d325 배포 이후라 괄호 귀속 재발 가능성이 낮다 — 세션 A 판독 후 절차(위)대로.

---

# BN CC 4차 회신 — BN-B 판독 증보 A~E (2026-09-19)

커밋 910b2dde(A~E) · d071b846(프롬프트 운영 키 제외). **재생성 리셋 선행 조건 충족(배포 READY 확인 후).**

## B 유입 경로 — 생성 시점 삽입(백필 아님) · 규모 큼
- 112517 유튜브 썸네일 = `blog_post_images`(image_type `stock_photo`, 2026-09-19 01:03) — issue-draft `insertImages` 가 네이버 이미지 검색 URL 을
  **차단 목록·관련도 채점·Storage 재호스팅 없이** 본문(최대 3장)과 `cover_image` 에 핫링크. 정식 파이프라인(image-pipeline · issue-image-attach)의 완전한 우회로.
- **30일 issue-draft 502편이 외부 스톡 이미지 · 발행 131편 · 502편 전부 외부 커버.** S8/S9 계보의 살아 있던 유입구.
- 수리: 생성 시점 삽입 중단(`EXTERNAL_IMAGE_INSERT_DISABLED`) — 이미지는 issue-image-attach 에 위임.
- **판정 필요(세션 A/Node)**: 기발행 131편의 외부 본문 이미지·외부 커버. 본문은 수정 금지 규율 — cover_image(메타)는 OG 로 되돌릴 수 있다. 목록:
```sql
SELECT DISTINCT b.id, b.slug, b.is_published, b.cover_image FROM blog_posts b JOIN blog_post_images i ON i.post_id=b.id
WHERE i.image_type='stock_photo' AND i.image_url !~ 'kadeora|supabase' AND b.cron_type='issue-draft' AND b.is_published;
```

## A ⑥ · C ⑦ — 전 부동산 글감 즉시 강제
- ⑥ 본문 이미지 src 가 kadeora.app · *.supabase.co 밖 → 결함. ⑦ `/apt/<slug>` 활성 현장 · `/blog/<slug>` 존재 글 DB 대조, 미실존 → 결함.
- 둘 중 하나라도 있으면 category=apt 글감 전부 hold: BN 은 `hold:bn_review:scan2`, 그 밖은 **`hold:scan2_hard`**(신설 사유, 가드 `hold:%` 로 재공개 차단). 섀도 없음.

## 스캔2 추가 규칙(판독 결함 기계화)
- 연도 예측: 일정어(착공·준공·입주·분양·관리처분·인가·일정…) 줄의 2026~2039 연도가 현장 블록에 없으면 결함. ⚠️ 상수 블록 연도(기한·시행일)는 허가 근거로 쓰지 않음 — 112520 을 통과시킨 원인.
- 유령 지명: 서울 밖 현장 글에 서울 고유 지명(강남역·광화문·여의도·잠실·압구정·강남구·서초구·송파구·용산구·마포구·성수동). 「교대역」(부산에도 있음)·「강남동」(진주에 있음)은 제외.
- 누출: 내부 트랙 표기(BN 허브·허브 발행·bn_hub·BP70·BP-B·BN-B).
- 실측 재스캔: 112517 → image·place(강남역·광화문)·leak·극값 / 112520 → year 6줄·link 2(/blog/apartment-charter·/blog/redev-basic)·leak·극값. **판독 결함 중 기계 미검출은 112520 취득세 1%(→ E 프롬프트)·경미 2(「중앙동로」·템플릿 잔재)뿐.**

## D 프롬프트
- 일정 규율(블록에 없는 연도·반기 금지, 「모집공고 후 확정」) · 표기 규율(내부 표기 금지, `/blog/<영문>` 창작 금지 — 상위 경로만).
- 「(BN 허브 발행)」 출처 = **CC 가 적재한 글감 summary** — DB 10건 정리 완료(RETURNING 10), 적재 SQL 문서 수정.
- 프롬프트 「원본 데이터」 JSON 에서 운영 키 제외(batch·bp70_count·scan2·regen_after·gate 기록·title_spec·complex_name_src·doc).

## E 조합원 취득세
- 정비사업 현장 블록에 「조합원 취득세: 원시취득 등 별도 규정 — 세율 숫자를 쓰지 않는다. 제도 상수의 주택 취득세는 유상 매매 기준」.
- 원시취득 상수 신설은 법령 원문(DRF) 대조가 필요해 이번엔 차선안(수치 금지). 상수 신설 원하면 별도 안건.

## 재생성 리셋(세션 A)
판독 §4 절차 그대로. 대상 112514~112523(10). 리셋 후 첫 회전부터 위 게이트·프롬프트가 적용된다.

---

# BN CC 5차 회신 — 리셋 집행 · 131편 본문 이미지 표본 실렌더 (2026-09-19)

## 리셋 — 세션 A 집행분은 «전무» 였다 → CC 가 원자 단일문으로 집행
- 검증: 10건 모두 `draft` + 옛 초안 연결 그대로(타임아웃 문은 롤백).
- 집행(단일 CTE): 초안 10편 `hold:bn_review*` → `hold:bn_regen_superseded`(10) · 글감 10건 초기화(publish_decision·blog_post_id·is_processed·retry_count·fail_reason·processed_at·block_reason, raw_data 게이트 기록 제거) + `raw_data.superseded_post`(옛 초안 id)·`regen_after='bn_b_readout_20260919'`(10). 재생성 모니터 가동.

## S9-2 선행 — 발행 글 외부 본문 이미지
- 범위: 발행 issue-draft 중 외부 stock_photo 보유 **전 기간 512편**(30일 132). 커버 외부 512/512.
- **DB 전수(512)**: 본문 마크다운에 외부 이미지 96편 — 그중 «이미지가 유일한 시각 요소»(자체 이미지 0 · 표 0) **0편**. 평균 표 3.1개.
- **표본 20편 실렌더**(kadeora.app 실페이지 `<article>` img 집계): 외부 이미지 렌더 20/20 · 자체 이미지 동반 20/20 · 표 20/20 · **외부만 남는 글 0/20** · og:image 외부 0/20(S9 isSafeCover 가 이미 막음).
  - 렌더되는 외부 출처: imgnews.naver.net(언론 보도사진 다수) · landthumb/dthumb/scs-phinf.pstatic.net · image.hogangnono.com · file.kbland.kr · i.ytimg.com · cloudfront · thinkpool.
  - 본문 마크다운 밖 경로도 있다: 페이지가 `blog_post_images`(인라인·갤러리)를 따로 그린다 — 본문 수정 없이도 외부 이미지가 나간다.
- **판단 자료**: 렌더 필터로 외부 이미지를 걷어도 텍스트만 남는 글은 표본·전수 모두 0 → S9-2 가 우려한 «빈약해지는 글» 위험은 실측상 없음.
  렌더러 `isSafeImg`(src/lib/image-sanitize.ts)는 세션 142 에서 블랙리스트(hc.go.kr 1건)로 바뀌어 위 출처를 전부 통과시킨다. 출처 대부분은 image-pipeline `IMG_BLOCK_DOMAINS` 에 이미 올라 있는 도메인이다(뉴스·경쟁 플랫폼) — 렌더러와 수집기가 서로 다른 목록을 쓰는 상태.
  → 필터 안(판정 필요): (a) 렌더러에 `IMG_BLOCK_DOMAINS` + `ytimg`·`dthumb` 적용(세션 142 의 «정당한 외부 CDN» 은 유지) (b) issue-draft 글 한정 자체 도메인 화이트리스트. 적용 대상은 본문 marked 렌더러 + blog_post_images 인라인·갤러리 두 경로.

### 재생성 절차 보정 (실측 2026-09-19)
- DB 트리거 `validate_blog_post` 는 INSERT 시 **상태 무관 동일 제목**이 있으면 `DUPLICATE_TITLE` 로 거부한다. 규격 제목(⑤)은 결정적이라 교체된 옛 초안이 새 초안의 제목 자리를 막는다(우동3·괴정5 실패).
- 보정: 옛 초안(비공개·`hold:bn_regen_superseded`) 제목에 ` [superseded <id>]` 부착(10편, 본문 무수정) → 두 글감 재큐잉.
- **이후 재생성 절차에 이 단계를 포함**: 사유 교체와 같은 문에서 제목 표식 부착.
- 재생성 1호 112524(사직4): 스캔2 결함 0 · 규격 제목 · 커버 자체 OG · 외부 이미지 0(증보 B 작동) · 링크 자기 현장만.
