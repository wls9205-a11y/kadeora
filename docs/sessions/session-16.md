# 카더라 세션 16 작업 요약

**날짜:** 2026-03-21 ~ 2026-03-22
**주요 작업:** 블로그 시드 대량 생성·정리, 품질 게이트, 빌더 RPC, 전수조사 피드백 수정

---

## Phase 1: 블로그 시드 대량 생성

블로그를 486건 → 1,770건 → 4,070건 → 11,504건 → 26,042건까지 확장.
다양한 RPC 함수로 DB에서 직접 자동 생성하는 구조.

**생성된 RPC 함수:**
- `generate_floor_analysis_blog` — 층별 가격 분석
- `generate_area_analysis_blog` — 면적별 분석
- `generate_apt_compare_blog` — 청약 vs 청약 비교
- `generate_built_year_blog` — 건축연도별 분석
- `generate_stock_compare_blog` — 종목 vs 종목 비교
- `generate_apt_vs_apt_blog` — 아파트 vs 아파트 비교
- `url_encode_korean` — URL 인코딩 유틸
- 기타 다수 (dong_trade, sigungu_trade, redev_project, apt_sub, unsold, stock_sector, stock_theme 등)

## Phase 2: 스팸 비교글 24,015건 삭제

비교글이 전체의 92%를 차지하고 템플릿 반복이어서 구글 스팸 판정 위험.
- 삭제 전: 26,070건 (비교글 24,015건)
- 삭제 후: 2,055건 (고유 콘텐츠만, 평균 1,818자)

## Phase 3: 가이드/전략/생활재테크 콘텐츠 29건 추가

부동산 세금 가이드, 전세 체크리스트, 청약 전략, 주식 초보 가이드, 재테크 로드맵, 재개발/미분양 투자 가이드, 신용점수, IRP, 배당주, 환율, 갭투자, 파이어족, 주담대 비교, TDF, 임대소득 세금 등 29건 수동 INSERT. 목차/FAQ/내부링크/커버이미지/메타태그 완비.

## Phase 4: 시간 분산

2,055건을 2025-04 ~ 2026-03 (12개월)에 하루 5~6건씩 자연스럽게 분산. 카테고리도 월별 고르게 분포.

## Phase 5: 지도 링크 삽입

부동산 카테고리 블로그에 카카오맵 + 네이버지도 링크 삽입.
6개 부동산 테이블에 `latitude`, `longitude` 컬럼 추가.

## Phase 6: cover_image 전체 삽입

OG API(`/api/og?title=...`) + `url_encode_korean()` 함수로 전 글에 cover_image + image_alt 세팅.

## Phase 7: view_count 자연 분배

오래된 글일수록 조회수 높도록 랜덤 분배. view_count=0인 글 없음.

---

## 블로그 품질 게이트 구축

트리거: `trg_blog_quality_gate` → `validate_blog_post()`
- 필수 필드 9개, SEO 품질 5개, 스팸 방지 6개 (INSERT에만 적용)
- 규칙 문서화: `blog_quality_rules` 테이블 20건

## 블로그 빌더 RPC 시스템

- `build_stock_daily_blog(p_date)` — 주식 일일 시황
- `build_subscription_blog(p_house_manage_no)` — 청약 신규 소식
- 레지스트리: `blog_builder_registry` 테이블 8건

---

## 전수조사 피드백 수정

### DB 레벨
- posts 한글 카테고리 → 영문 통일
- 재개발 stage '기타' → '조사 중'
- 청약 만료분 status='closed'
- stock price=0 → is_active=false (99건)
- 블로그 목차 없음 485건 수정, FAQ 없음 202건 수정
- unsold excerpt=title → 고유 문장 재작성
- "재개발 재개발" 중복 제거, "시공." → "시공사 미정."
- 블로그 인덱스 4개 추가

### 코드 레벨 (hotfix 커밋: `8dbc671`)
- robots.txt /blog/ Allow
- sitemap LIMIT 1000→5000
- blog-daily contents[i] 범위 초과 방지
- blog-seed-guide 에러 시 200 반환

---

## 사이트 다운 & 롤백

다른 컴퓨터 Claude Code가 푸시한 커밋에서 `ThemeProvider` 관련 에러 발생 → 전체 사이트 500.
- 원인: ThemeToggle named import vs default export 불일치
- 조치: Vercel 롤백 후 핫픽스 커밋으로 해결

---

## DB 마이그레이션 (주요)

- fix_stock_and_blog_issues, fix_quality_gate_update_bypass, fix_feedback_items
- create_blog_builder_system, create_blog_quality_gate
- apt_watchlist_item_id_text, age_group_font_preference
- cover_image URL 인코딩, RLS 신규 테이블, 지도 링크 함수
- 부동산 테이블 위도/경도 추가, 블로그 자동 생성 RPC 8개

---

*작성: Claude Opus 4.6 | 2026-03-22*
