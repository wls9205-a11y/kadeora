# 카더라 프로젝트 STATUS — 세션 43 (2026-03-28 KST)
> 호스팅어 전수조사 + 블로그 10가지 개선 + 309편 크론 + 블로그 전수조사
> **다음 세션 시작:** "docs/STATUS.md 읽고 작업 이어가자"

## 프로덕션 현황 (실시간)

| 지표 | 수치 |
|------|------|
| **유저** | 119명 |
| **게시글/댓글** | 4,082 / 2,604 |
| **블로그** | 15,502편 |
| **주식 종목** | 247개 |
| **청약** | 2,685건 |
| **apt_sites (active)** | 5,505 |
| **실거래** | 5,408건 |
| **미분양** | 203건 |
| **재개발** | 202건 |
| **토론** | 30개 |
| **프로덕션 에러** | 0건 |

## 코드베이스

| 지표 | 수치 |
|------|------|
| 파일 수 | 506개 |
| 총 줄 수 | 57,323줄 |
| API 라우트 | 167개 |
| 크론 | 73개 (57+14신규+2) |
| DB 테이블 | 125개 |
| `as any` | 62건 |
| `ignoreBuildErrors` | **false** |
| `tsc --noEmit` | 0건 에러 |

---

## 세션 43 완료 작업 (2026-03-28)

### 1. 호스팅어 전수조사 + 수리 [COMPLETED]

**사업자 정보 제거:**
- 117개 도메인 (WP 111개 + Empty 6개)
- stockcoin.net jetpack_options 1건, 급매물 RankMath+Elementor 9건 제거

**tel: 전화 버튼 정밀 제거:**
- 111개 WP 사이트 DB 전수 스캔 → 61개 사이트에서 발견
- **총 ~3,800건 제거:** post_content ~300건, Elementor ~2,500건, options ~40건, 전화텍스트 ~30건, SFM 플로팅 38사이트
- 최종: 전 항목 0건 ✅

**기타:** Timezone 105개 Asia/Seoul, robots.txt 2개 생성, .htaccess HTTPS 3개 위성

### 2. 블로그 시스템 10가지 개선 (c1fe899) [COMPLETED]

| # | 개선 | 내용 |
|---|------|------|
| 1 | 👍 도움이 됐어요 + 북마크 | blog_helpful, blog_bookmarks 테이블 + RLS + API 2개 + BlogActions |
| 2 | 블로그 전용 RSS | `/blog/feed` 라우트 + robots.txt + layout.tsx 링크 |
| 3 | 발행 시 푸시 알림 | blog-publish-queue에 sendPushBroadcast |
| 4 | 서브카테고리 필터 | stock/apt/unsold/finance 하위 칩 UI + 쿼리 |
| 5 | 이전/다음글 네비게이션 | 같은 카테고리 내 시간순 |
| 6 | 업데이트 뱃지 | rewritten_at 기반 🔄 UP 표시 |
| 7 | 카드 디자인 강화 | 읽기시간·조회수·댓글수·helpful·UP 뱃지 |
| 8 | auto-link 확장 | 51→100+ 키워드 |
| 9 | 인기 태그 클라우드 | blog_popular_tags RPC + UI |
| 10 | 어드민 성과 대시보드 | TOP10·댓글TOP·helpful TOP·7일 추이 |

**DB:** blog_helpful + blog_bookmarks 테이블, helpful_count 컬럼, blog_popular_tags RPC, blog_category_views RPC

### 3. PostWithProfile 빌드 에러 수정 (23b6fae) [COMPLETED]
- database.ts 끝에 PostWithProfile, CommentWithProfile export 복원
- grade: number | null, profiles에 id?: string

### 4. 블로그 309편 대량 생성 크론 14개 (18af482) [COMPLETED]
- 14개 신규 크론 (5,017줄), GOD MODE content 그룹 등록
- vercel.json 매월 1~14일 새벽 2시 순차 스케줄
- safeBlogInsert에 is_published 파라미터 추가
- daily_create_limit 80 임시 상향 (완료 후 10 원복 필요)

### 5. 블로그 전수조사 + 3가지 이슈 수정 (4ab3230) [COMPLETED]

| # | 이슈 | 수정 |
|---|------|------|
| 1 | RSS pubDate Invalid Date (39편) | published_at null → created_at 폴백 |
| 2 | 빈 태그 815건 | array_remove(tags, '') |
| 3 | generic cover_image 12,464건 | → null (코드에서 제목 기반 OG) |
| 4 | published_at null 39편 | created_at으로 채움 |

**전수조사 정상 확인:** SSR 15,502편, 카테고리 6개, 인기글, 태그 클라우드, 시리즈, OG 이미지, TOC, FAQ, 댓글, 관련글, 공유, 도움이됐어요/저장, JSON-LD 4종

---

## 세션 43 커밋

| SHA | 내용 |
|-----|------|
| `4ab3230` | 블로그 전수조사 3가지 이슈 수정 |
| `18af482` | 14개 대량 블로그 크론 (5,017줄) |
| `23b6fae` | PostWithProfile 타입 복원 |
| `54bdf6a` | 부동산 KPI 실거래 표시 형식 통일 |
| `c1fe899` | 블로그 10가지 개선 |
| `794ab7f` | 부동산 실거래 KPI 0건 수정 |
| `22cae1a` | SEO geo 강화 + 프롬프트 다양화 |
| `b946de7` | 블로그 시각화 v2 |
| `d6b5c84` | 블로그 위치 정보 깨짐 수정 |

---

## Vercel 에러 현황

- **500 에러:** 0건 ✅
- **AuthApiError:** /admin, /login — 만료 세션 리다이렉트 (무해)
- **Failed to load dynamic font:** /api/og — 한글 폰트 폴백 (비긴급)

---

## 핵심 파일 경로

### 블로그
- `src/app/(main)/blog/[slug]/page.tsx` — 상세 (TOC/FAQ/댓글/관련글)
- `src/app/(main)/blog/feed/route.ts` — 블로그 RSS
- `src/components/BlogActions.tsx` — 도움이됐어요 + 북마크
- `src/lib/blog-auto-link.ts` — 100+ 키워드
- `src/lib/blog-visual-enhancer.ts` — 8가지 시각 요소

### 어드민
- `src/app/admin/sections/system.tsx` — GOD MODE 73크론
- `src/app/admin/sections/blog.tsx` — 블로그 성과 대시보드

### 인프라
- `src/types/database.ts` — 끝에 PostWithProfile/CommentWithProfile 커스텀 타입

---

## 🟡 PENDING 작업

### 긴급 수동
- [ ] **토스 정산 등록 (3/31 마감 D-3!)**
- [ ] **주린이.site DNS 복구** — 호스팅어 hPanel 네임서버 변경

### 블로그 309편 분할 실행
- [ ] daily_create_limit 80 확인 후 크론 순차 실행
- [ ] district-guide 120편 3회 분할 (offset=0/40/80, limit=40)
- [ ] 완료 후 daily_create_limit 10 원복

### 수동 필수
- [ ] GA stockcoin.net 데이터 스트림 제거
- [ ] 구글 서치콘솔 분양권실전투자.com 등록
- [ ] 네이버 서치어드바이저 3사이트 RSS/사이트맵
- [ ] Bing 웹마스터 3사이트 인증코드 교체
- [ ] 토스 라이브키 교체
- [ ] KIS_APP_KEY 발급

### 기존 PENDING
- [ ] /api/og 한글 폰트 포함 (Pretendard)
- [ ] as any 62건 정리
- [ ] 지역별 현황 디자인 변경

## 주의사항 (다음 세션 필독)
- **PostWithProfile:** database.ts 끝 커스텀 타입 — Supabase 타입 재생성 시 유지
- **safeBlogInsert:** is_published 파라미터 추가됨 (기본값 false)
- **daily_create_limit:** 현재 80 → 완료 후 10 원복
- **blog_helpful RLS:** 로그인 유저만 INSERT/DELETE
- **블로그 데이터:** 절대 삭제/수정 금지
- **stockcoin.net:** 절대 카더라와 연결 금지

## 트랜스크립트
- 세션 43: `/mnt/transcripts/2026-03-28-01-13-33-2026-03-28-01-00-12-kadeora-session43-blog-hostinger-admin.txt`
- 세션 40~42: `/mnt/transcripts/2026-03-27-08-28-51-kadeora-session40-42-satellite-admin-blog.txt`
