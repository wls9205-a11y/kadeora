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
