# 네이버 1위 마스터플랜 v3 — 6층 아키텍처 최종판

> 작성: 2026-04-18 (v2 폐기, v3 최종)
> v2에서 누락된 5개 레이어 중 가장 크리티컬한 3개를 추가 (Authority / Measurement / Distribution)
> 근거: v1·v2 진단 + 6회 추가 실측 (E-E-A-T / trending 커버리지 / 킬러 URL timeout / 이미지 CDN / Next Image / 멀티채널)

---

## 0. v2도 최선이 아니었다 — 5개 구멍 실측

**v2가 놓친 것들**:

1. **저자 실명 0명** — `blog_posts.author_name distinct 7개` 전부 "카더라 데이터팀/부동산분석팀..." 가상 이름. 네이버 C-Rank 저자 신뢰도 **측정 불가**
2. **trending_keywords 커버리지 극단적 파행** — heat_score 100인 "소프트캠프/오가닉티코스메틱/한빛레이저/이노뎁" **커버 0편**. 제네릭 "부동산분석" 576편. 즉 급등주 실시간 선점 **완전 누락**
3. **킬러 글 URL이 지금 이 순간 504 맞고 있음** — 14:09:54 레이카운티 + 14:09:55 두산위브 동시 timeout. 크롤러가 재시도하면서 **크롤 예산 낭비 + 불안정 시그널**
4. **측정 레이어 부재** — GSC/GA4/Naver Analytics 연동 테이블 0. 실제 쿼리·노출·CTR·순위를 **모르고 의사결정**
5. **멀티채널 배포 전무** — YouTube Shorts / Kakao View / Brunch / Velog 테이블·크론·코드 전무. 블로그 1편 = 채널 1개

**추가 발견**: `blog_post_images` 19,831장 (62%)이 네이버 CDN 핫링크. `<img src>` 직접 렌더 (Next Image 미사용) → LCP 최적화 전무. 네이버 차단 시 대량 깨짐 리스크.

---

## 1. 6층 아키텍처

```
┌───────────────────────────────────────────────────────┐
│  Layer 5: Distribution (멀티채널)                     │
│  YouTube Shorts / Kakao View / Brunch / 인스티즈 자동 │
├───────────────────────────────────────────────────────┤
│  Layer 4: Measurement (측정)                          │
│  GSC / GA4 / Naver Analytics 실데이터 연동           │
├───────────────────────────────────────────────────────┤
│  Layer 3: Content (콘텐츠)                            │
│  킬러 DNA / trending 선제 / 이슈 파이프라인           │
├───────────────────────────────────────────────────────┤
│  Layer 2: Platform (플랫폼)                           │
│  naver_syndication + Hostinger + Daum + AI bots      │
├───────────────────────────────────────────────────────┤
│  Layer 1: Infra (인프라)                              │
│  DB / 쿼리 / 인덱스 / Vercel / 크론 / 킬러 URL static │
├───────────────────────────────────────────────────────┤
│  Layer 0: Authority (권위) ← 모든 층의 밑바닥         │
│  저자 실명 / 네이버 인플루언서 / E-E-A-T 시그널      │
└───────────────────────────────────────────────────────┘
```

### 각 층이 없으면?
- **L0 없음** → 네이버 C-Rank 저자 축 0 → 위 5층 효과 -50%
- **L1 느림** → 크롤러 타임아웃 → 인덱싱 실패 → 위 4층 의미 없음
- **L2 없음** → 도메인 authority 안 오름 → DIA 높아도 1페이지 진입 불가
- **L3 평범** → 쓴 만큼 묻힘
- **L4 없음** → 우선순위 의사결정 감으로 → 자원 낭비
- **L5 없음** → 확산 안 됨 → 네이버 단일 의존 위험

---

## 2. Layer 0 — Authority (권위) — **1순위**

**문제**: 저자 실명 0명, 가상 팀명 7개. 네이버 C-Rank의 "누가 썼는가" 축이 거의 **비어 있음**. YMYL(금융·부동산) 특성상 이 누락은 치명적.

### L0-1: Node 본인 실명 저자 프로필 신설 (P0, 2시간)
- `/about/authors/node` 페이지 생성: 실명 + 배경 + 카더라 설립 경위 + 전문 영역 + SNS
- JSON-LD `Person` schema (sameAs로 공식 SNS 링크)
- 블로그 상세 저자 카드에 "프로필 →" 링크 연결
- 네이버 검색 "노영진" / "카더라" 쿼리에서 본인이 노출되도록 백링크 분산

### L0-2: 저자별 블로그 할당 체제 (P0, 3시간)
- 현재 7개 가상팀 → 실명 저자 체제로 재편
- Phase 1: Node 1명 담당 — manual 글은 Node 실명, auto 글은 "카더라 편집부 (AI-assisted)" 라벨
- Phase 2 (향후): 초청 저자 2~3명 확보 (부동산·주식 전문 블로거 제휴)
- `author_role` 을 구체화: "부산 부동산 분석 10년차", "미국주식 전업 투자자" 등 검증 가능한 표현

### L0-3: 네이버 인플루언서 등록 (P0, Node 액션)
- 부동산 또는 재테크 카테고리로 네이버 인플루언서 신청
- 인플루언서 선정 시 네이버 VIEW 탭 **고정 노출 구좌** 확보 — 단일 레버로 가장 큰 트래픽 부양
- 필요 조건: 네이버 본 계정 블로그 글 100+, 1,000+ 이웃
- Node 현재 개인 네이버 블로그 상태 확인 필요

### L0-4: 네이버 블로그 본 계정 운영 시작 (P0, 3일)
- 카더라 공식 네이버 블로그 개설 (이미 있으면 활성화)
- L2-1의 naver_syndication을 여기로 자동 발행
- 지수 상승 목표: 3개월 내 **최적화 단계** (옵티마이즈/준최적화 등 네이버 내부 지수)
- **주간 3회 이상 발행** — 네이버는 발행 리듬 + 일관성 가산점

### L0-5: 외부 인용·출처 강화 (P1, 2시간, rewrite cron에 반영)
- 현재 auto 글 `source_ref` 자주 null. 실명 출처 (국토부 보도자료 URL, 금감원 공시 링크) 자동 주입
- 블로그 본문 하단 "참고자료" 섹션 자동 생성
- 외부 dofollow 링크는 nofollow (authority 누수 방지)

### L0-6: YMYL 면책·전문성 배너 (P1, 1시간)
- 금융·부동산 글은 본문 상단에 **"투자자문 아님" + "데이터 출처"** 배너
- 저자 자격 표기 ("국토부 공공데이터 기반 분석") — 네이버 신뢰도 + 법적 방어 2가지 동시

---

## 3. Layer 1 — Infra (인프라) — **2순위, v2 유지 + 추가**

**v2 대비 추가**:
- 킬러 글 URL 강제 static pin
- crawler 재시도 패턴 감지
- Next Image 전환

### L1-1: `/blog/[slug]` 쿼리 다이어트 (P0, 3시간) [v2 유지]
18~20개 DB 쿼리 → 8개 이하, React cache, Promise.all 병렬화

### L1-2: 중복·미사용 인덱스 드롭 (P0, 30분)
- drop: `idx_blog_posts_slug`, `idx_blog_list`, `idx_blog_posts_category_tags`, `idx_blog_posts_published_recent`, `idx_blog_posts_pgroonga_*`, `idx_blog_posts_content_length`, `idx_blog_posts_title_length`
- 회수: 인덱스 30MB+

### L1-3: VACUUM FULL + weekly ANALYZE cron (P0, 1시간)

### L1-4: 좀비 크론 청소 + 이미지 생성 실패 해결 (P0, 4시간)
- `cron_logs` status='running' 15분 초과 → 자동 stale 마킹
- Redis lock으로 동시 실행 방지
- `blog-generate-images` 35% 실패 + `blog-image-supplement` 52% 실패 원인 수정

### L1-5: **킬러 글 URL 강제 static pin** (P0 신규, 2시간) — v3 추가
**문제**: 14:09:54 레이카운티 504. 도메인 PV 78% 차지하는 글이 timeout = 재앙
**조치**:
- `generateStaticParams`를 **view_count 상위 20편 + apt_sites 중 interest_count 상위 20편 + stock top 20 = 60편** 강제 static 생성
- 이들은 **빌드 타임에만 SSG**, runtime 쿼리 0회
- revalidate 주기: 15분 → 1시간 (안정성 우선)
- 네이버 Yeti가 이 60개 URL만 주로 돌아도 무조건 초고속 응답 보장

### L1-6: **Crawler 재시도 패턴 감지·차단** (P0 신규, 2시간) — v3 추가
**문제**: 같은 URL 30초 내 3~10회 재시도 로그 발견
**조치**:
- middleware에 UA=Yeti/Googlebot + 같은 URL 10초 내 3회+ 요청 → 직전 응답 캐시 즉시 반환
- Edge Config로 crawler blocklist 동적 관리
- `unsold-analysis-58-...` 같은 문제 URL 반복 발견 시 static pin 큐에 추가

### L1-7: Bot Edge Caching (P0, 4시간) [v2 유지]
UA=bot인 경우 Edge KV/Redis 1시간 캐시

### L1-8: **Next Image 전환** (P1 신규, 4시간) — v3 추가
**문제**: blog 상세 `<img src="...">` 직접 렌더. LCP 최악.
**조치**:
- `BlogHeroImage` 컴포넌트만 Next Image 전환 (이미 일부 적용, 확장)
- 본문 내 이미지는 `remarkPlugin`으로 `<Image>` 변환 (안 되면 `loading="lazy" decoding="async" fetchpriority` 하드 튜닝)
- 네이버 CDN 이미지는 `unoptimized` flag로 통과 (Next Image 거치면 pstatic CDN 이점 사라짐)

### L1-9: 네이버 CDN 핫링크 리스크 대응 (P2, 2시간)
- 19,831장 네이버 CDN 핫링크 → 차단 시 대량 깨짐
- 핵심 글(view_count 상위 100)의 이미지는 자체 Supabase Storage로 미러링
- 그 외는 원본 유지 (네이버 이미지 탭 노출 이점)

### L1-10~13: v2의 L1-5, L1-7 유지 (쿼리 패턴 회귀 / 파티셔닝 설계)

---

## 4. Layer 2 — Platform (플랫폼) — **v2 유지 + Trending 파이프라인 추가**

### L2-1: `naver_syndication` 자동화 완전체 (P0, 1일) [v2 유지]
60건 생성 / 6건 발행 → 운용률 80%+

### L2-2: Hostinger 109사이트 ↔ 카더라 백링크 (P0, 2일) [v2 유지]
신규 테이블 `satellite_sites` + `satellite_backlinks` + cron `satellite-backlink-distribute`

### L2-3: IndexNow submission 로그 + 재시도 (P1, 2시간) [v2 유지]

### L2-4: 네이버 Search Advisor 재검증 (P0, 30분) [v2 유지]

### L2-5: 네이버 카페 타겟 정밀화 (P1, 3시간) [v2 유지]

### L2-6: AI 검색 대응 (llms.txt 최적화) (P2, 2시간) [v2 유지]

### L2-7: **trending_keywords → 선제 블로그** (P0 신규, 4시간) — v3 추가
**문제**: heat_score 100인 급등주 "소프트캠프/오가닉티/한빛레이저/이노뎁" 커버리지 0편
**조치**:
1. `issue-preempt` cron에 Phase 5 추가:
   ```
   trending_keywords WHERE heat_score >= 70 AND updated_at > now() - interval '12 hours'
   JOIN blog_posts 커버 여부 체크 (0편 + category=stock|apt)
   → issue_alerts 자동 편입 with multiplier 1.5 (선점 + 트렌딩 2중 가산)
   ```
2. `issue-draft`가 즉시 drafting — 주기 30분
3. trending 선점 글은 `is_auto_publish=true` 강제 + fact_check bypass (데이터 기반)
4. **목표**: heat_score ≥70 트렌딩 키워드 → 30분 내 블로그 발행

### L2-8: **Daum/Zum/Bing 동시 등록** (P1 신규, 1시간) — v3 추가
- robots.txt는 허용, 실제 웹마스터 도구 등록 상태 미확인
- Daum 검색등록, Zum 검색 제출, Bing Webmaster Tools 연동 완료
- Bing Webmaster는 GSC 데이터 import 가능 → 무료 L4 측정 첫 자산

### L2-9: **RSS 품질 강화 + PubSubHubbub** (P2 신규, 2시간) — v3 추가
- `/feed.xml` 품질 점검 (현재 존재 여부 확인 필요)
- PubSubHubbub hub 등록 → 발행 즉시 구글/Bing/Feedly에 실시간 푸시

---

## 5. Layer 3 — Content (콘텐츠) — **v2 유지**

### L3-1: 킬러 DNA 템플릿 [v2 유지]
레이카운티 DNA 추출: 4,000~5,000자, 감정+숫자 리드, 표 50+, 태그 12개, manual > auto

### L3-2: 이미지 주입 자동화 (L1-4와 통합)
### L3-3: 이슈 선점 pending 230건 drain + competition_score [v2 유지]
### L3-4: 자체 진화 5종 세트 [v2 유지]
### L3-5: 내부 링크 그래프 강화 [v2 유지]
### L3-6: JSON-LD seed 필터 (P0, 10분) [v2 유지]
### L3-7: 참여 시그널 계측 정상화 [v2 유지]
### L3-8: 익명 반응 버튼 [v2 유지]
### L3-9: meta_description 일괄 재생성 batch [v2 유지]
### L3-10: 청약분석 태그 4→10 확장 [v2 유지]

---

## 6. Layer 4 — Measurement (측정) — **v3 신규, Phase 2 말까지 세팅**

**핵심 사상**: 실제 데이터 없이는 어떤 글을 키울지 결정 못 함. 현재는 `view_count`만 보고 있는데 이건 "이미 찾아온 사람" 수치. GSC·GA4는 "아직 못 찾은 사람 + 놓친 기회" 수치.

### L4-1: Google Search Console 연동 (P0, 4시간)
- GSC API 액세스 토큰 확보 (Node 계정)
- 신규 테이블 `gsc_queries` (date, query, page, impressions, clicks, ctr, position)
- 일 cron `gsc-sync` — 28일 전 데이터 pull
- 관리자 대시보드에 "노출은 많은데 CTR 낮은 키워드" 리포트 → 제목 재작성 큐

### L4-2: Naver Search Advisor 데이터 pull (P0, 3시간)
- 네이버 Search Advisor API 있으면 연동, 없으면 CSV 주기 업로드
- 신규 테이블 `naver_sa_queries` (유사 구조)
- GSC와 조인 → 어느 키워드가 네이버만 상위/구글만 상위인지 판별

### L4-3: GA4 Events 백플로우 (P1, 4시간)
- GA4가 설정되어 있으면 (gtm 스크립트 확인) Measurement Protocol으로 서버측 이벤트 통합
- 신규 테이블 `ga4_events` (일 agg)
- `blog_posts.effectiveness_score`를 GA4 평균 참여 시간 기반으로 재정의

### L4-4: 대시보드 "어떤 글을 키울까" 뷰 (P1, 3시간)
- 주간 Top N 제안:
  1. GSC 노출 상위 + CTR 하위 → 제목 재작성
  2. Naver 노출 상위 + 클릭 하위 → 동일
  3. 체류 상위 + 공유 하위 → 공유 CTA 강화
  4. GA4 이탈률 상위 → 본문 구조 개편

### L4-5: Core Web Vitals 실측 수집 (P1, 2시간)
- Next.js `reportWebVitals` → 서버 전송 → `web_vitals` 테이블
- LCP / CLS / INP 페이지별 분포 대시보드
- **LCP > 2.5s 페이지는 Phase 1 끝난 뒤 자동 탐지 + L1-1 적용 큐**

### L4-6: A/B 제목 테스트 프레임워크 (P2, 4시간)
- L3-4의 제목 A/B를 L4 데이터 기반으로 자동화
- 3안 × 7일 × GSC CTR 비교 → 승자 고정

---

## 7. Layer 5 — Distribution (멀티채널) — **v3 신규, Phase 3부터**

**핵심 사상**: 네이버 단일 의존은 위험. 글 1편 작성 비용이 이미 높은데, 자동 multi-channel 배포로 multiplier 확보.

### L5-1: YouTube Shorts 자동 생성 (P1, 1일)
- 블로그 top 글 → 60초 요약 스크립트 생성 (Anthropic)
- TTS (네이버 Clova Voice API 또는 Amazon Polly) → 음성
- 썸네일 자동 (기존 OG 이미지 + 강조 텍스트)
- FFmpeg으로 합성 (Vercel Functions 불가 → Railway/Fly.io 별도 서비스)
- YouTube Data API로 업로드 + 카더라 링크 1번째 줄 고정
- **주 3편부터 시작, 성공 검증 후 일 1편**

### L5-2: Kakao View 자동 배포 (P1, 4시간)
- 카카오뷰 채널 개설 + API 연동
- naver_syndication 구조 차용 → `kakao_view_syndication`
- 부동산·재테크 채널 수요 높음 (실증 필요)

### L5-3: Brunch 제휴 발행 (P2, 4시간)
- Brunch는 공식 API 없음 → Puppeteer 자동 발행
- 재테크·부동산 카테고리 Brunch 상위 노출 가능
- 주 1~2편 (수작업 감각)

### L5-4: 인스티즈·뽐뿌·MLBPARK 배포 (P2, 3시간)
- 2030 부동산 커뮤니티
- 단순 링크 공유는 스팸 → **요약 + 원본 링크** 포맷
- 계정 정지 리스크 → IP 분산 + 자연스러운 템플릿

### L5-5: 인스타그램 릴스·카드뉴스 (P2, 4시간)
- 블로그 이미지 + 핵심 3줄 → 카드뉴스 9장 자동 생성
- Meta Graph API로 인스타 계정 연동
- 모바일 유입 추가 채널

### L5-6: 이메일 뉴스레터 복원 (P2, 2시간)
- `email-digest` cron 100% silent fail 상태 (세션 133에서 언급됨)
- 디버그 + 재가동
- 주간 top 5 글 + trending keywords

### L5-7: 네이버 포스트 (P1, 2시간)
- 네이버 블로그와 별도 "네이버 포스트" 채널 (모바일 중심)
- naver_syndication을 포스트까지 확장
- 포스트는 VIEW 탭 별도 노출 구좌

### L5-8: 멀티채널 전환 추적 (P1, 3시간)
- 각 채널 → 카더라 UTM 파라미터 고유
- `channel_attribution` 테이블 (visitor_id, first_channel, last_channel, converted_at)
- 채널별 LTV 산출 → 투자 재분배

---

## 8. 우선순위 기반 실행 (6주 계획)

### Phase 1 (Week 1) — **기초공사: 인프라 + 권위**
절대 건너뛸 수 없음. 여기서 발 묶이면 나머지 전부 무효.

**L0 (권위) 즉시**:
- L0-1: Node 실명 저자 프로필 (2h)
- L0-2: 저자 체제 재편 (3h)
- L0-3: 네이버 인플루언서 신청 (Node 액션)
- L0-4: 네이버 블로그 본 계정 개설 (Node + 3일)

**L1 (인프라)**:
- L1-5: **킬러 글 URL static pin** (최우선, 2h)
- L1-6: Crawler 재시도 차단 (2h)
- L1-2: 인덱스 드롭 (30m)
- L1-3: VACUUM + weekly cron (1h)
- L1-4: 좀비 크론 + 이미지 생성 35% 실패 해결 (4h)
- L1-1: 쿼리 다이어트 (3h)
- L1-7: Bot Edge 캐싱 (4h)

**L3 (퀵 윈)**:
- L3-6: JSON-LD seed 필터 (10분)
- L3-9: meta_description batch submit (밤새)

**Week 1 KPI**
- Vercel timeout 시간당 20+ → 0~2
- 킬러 글 (top 20) 504 0건
- Node 실명 저자 프로필 라이브
- 네이버 블로그 본 계정 개설 + 첫 발행 3편

### Phase 2 (Week 2) — **플랫폼 + trending 선점**
**L2**:
- L2-7: trending_keywords → 선제 블로그 (4h) ← **가장 큰 한 방**
- L2-1: naver_syndication 자동화 (1일)
- L2-2: Hostinger 109 백링크 (2일)
- L2-4: Naver SA 재검증
- L2-8: Daum/Zum/Bing 등록

**L3**:
- L3-1: 킬러 DNA 템플릿 → blog-rewrite 적용
- L3-5: 내부 링크 강화
- L3-3: issue-pipeline 230건 drain + competition_score

**Week 2 KPI**
- naver_syndication 운용률 16% → 80%
- trending 급등주 커버리지 0 → 80% (heat_score ≥70)
- Hostinger 백링크 주 100+

### Phase 3 (Week 3) — **측정 레이어 구축**
**L4**:
- L4-1: GSC 연동 (4h)
- L4-2: Naver SA 데이터 (3h)
- L4-3: GA4 Events (4h)
- L4-5: Web Vitals 실측 (2h)
- L4-4: "어떤 글을 키울까" 대시보드 (3h)

**L3 병행**:
- L3-4: 자체 진화 (데이터 만료, 제목 A/B, 신규 엔티티 링크, 댓글 FAQ)
- L3-7: 참여 계측 정상화
- L3-8: 익명 반응 버튼

**Week 3 KPI**
- GSC/Naver SA 실데이터 확보
- view_logs coverage 0.28% → 40%+
- Web Vitals LCP 측정 시작

### Phase 4 (Week 4) — **멀티채널 확산**
**L5**:
- L5-7: 네이버 포스트 (2h, 가장 쉬움)
- L5-2: Kakao View (4h)
- L5-6: 이메일 뉴스레터 복원 (2h)
- L5-8: 채널 attribution (3h)
- L5-1: YouTube Shorts (1일, 가장 복잡)

**Week 4 KPI**
- 4개 이상 채널에서 주간 카더라 링크 300+ 배포
- 비네이버 유입 4.4% (Google) → 8%+

### Phase 5 (Week 5) — **고도화·자동화 강화**
- L0-5, L0-6: E-E-A-T 강화 (출처·면책)
- L2-5: 네이버 카페 타겟 정밀화
- L5-3~5: Brunch, 커뮤니티, 인스타
- L4-6: A/B 제목 자동화
- L1-8, L1-9: Next Image + CDN 미러

### Phase 6 (Week 6) — **측정·피드백·보안 마감**
- 1~5주 KPI 종합 + 그다음 분기 계획
- Phase 2의 보안 마감 (CSP nonce, SSRF, rate limit 전용 tier) — v2의 WP-4 흡수
- A/B 결과 기반 실패 글 정리

---

## 9. 성공 지표 (북극성 하나)

### 북극성
**네이버 referrer 주간 PV + 네이버 인플루언서 선정 여부**
- Week 0: 1,708 PV, 인플루언서 ❌
- Week 6: 8,000 PV, 신청 완료
- Week 12: 25,000 PV, **선정 완료**
- Week 24: 80,000 PV, Tier 1 키워드 10개 상위 3위

### 하부 지표는 v2와 동일 유지

---

## 10. 리스크 업데이트 (v2 대비)

| 리스크 | v2 | v3 추가 |
|---|---|---|
| Vercel timeout 중 킬러 글 영향 | 간접 영향 | **직접 실측** — L1-5 static pin 필수 |
| 저자 실명 공개 → Node 프라이버시 | 언급 없음 | 필명/법인 + 이력 명시 타협안 |
| 네이버 인플루언서 심사 탈락 | 언급 없음 | 본 블로그 글 100편 + 이웃 확보 3개월 선행 |
| YouTube Shorts 상표권·저작권 | 언급 없음 | 네이버 CDN 이미지 사용 시 Shorts는 자체 이미지만 |
| Brunch/커뮤니티 도배 처벌 | 언급 없음 | 주 1~2편 자연 리듬 + 다계정 분산 |
| GSC/GA4 연동 시 개인정보 | 언급 없음 | 익명화 + Node 계정 API 키 관리 |

---

## 11. 왜 이게 최선인가 (자기 비판 포함)

### 이 v3가 v2보다 나은 점
- **5개 결정적 구멍**을 실측으로 증명하고 편입
- 6층 아키텍처로 각 층의 독립성·의존성 명확
- L4(측정)가 생겨 감에 의한 의사결정 제거
- L5(멀티채널)로 네이버 단일 의존 리스크 분산
- L0(권위)이 밑바닥에 와서 네이버 C-Rank 직결

### v3도 최선이 아닐 수 있는 지점
- **실제 네이버 인플루언서 심사 기준 · 등급 체계의 최신 정책** 미반영 (2026년 기준 확인 필요)
- **Hostinger 109 사이트의 SEO 건강도** 미측정 (이미 스팸 처리된 사이트가 있으면 백링크 역효과)
- **Node 본인의 시간 예산** 가정 — 6주 동안 개인 시간 투입 가능한가
- **심사 제출 필요한 것들**(인플루언서·검색등록) Node가 직접 해야 하는 부분 — 자동화 불가
- **Search Console·GA4 이미 연동돼 있는지 최종 확인 없음** — 있으면 L4-1이 30분으로 단축

### 진짜 최선이 되려면 v4에서 해결해야 할 것 (참고)
- Web Vitals 실측 (PageSpeed / CrUX 데이터) — 코드만으로는 모르는 필드 지표
- Node의 경쟁자 분석 (같은 키워드 네이버 상위 블로그들의 글 구조·백링크 패턴)
- 월간 비용 예산 (Anthropic batch, Railway/Fly.io for Shorts, Naver API 할당)
- Node의 본 네이버 블로그 계정 실태

---

## 12. 실행 규칙

1. 모든 작업: `[L0-2]`, `[L1-5]`, `[L4-1]` 형식 prefix
2. 각 Phase 시작 전 `STATUS.md` 에 phase header 추가
3. 매주 일요일 **KPI 측정 + v3 문서에 진행 상황** 섹션 append
4. **Node 손이 필요한 항목** (L0-3 인플루언서 신청, L0-4 네이버 블로그, L4-1 GSC 토큰, L5-1 YouTube 계정)은 착수 전 Node에게 확인 요청

---

## 다음 세션 진입 신호

**"v3 Phase 1 시작"** 또는 **"L0-L1 착수"** → 위 Phase 1 체크리스트 병렬 진행.

단, L0-3, L0-4 처럼 Node 손이 필요한 것은 **Phase 1 첫날에 Node에게 한 번에 리스트업** 해서 받음.

---

**작성자 주**: v1 → v2 → v3으로 오면서 실측 범위가 (1) DB 내부만 (2) + Vercel + 크론 (3) + 측정·멀티채널·저자까지 확장됐다. v4가 필요해지는 순간은 "네이버 Yeti 실제 크롤 패턴 + 네이버 검색 알고리즘 2026년 정책"을 외부에서 확보했을 때. 그전까지는 v3로 6주를 돌린 결과가 최선의 다음 판단 근거.
