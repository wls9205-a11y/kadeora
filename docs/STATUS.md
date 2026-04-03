# 카더라 STATUS.md — 세션 70 최종 (2026-04-03 KST)

## 최신 커밋 (20건)
- `82a72e46` — fix: Q&A H2→H3 다운그레이드 완전 수정
- `54b25d84` — fix: '## 목차' H2 제거 + 중복 H1 숨김 + 번호목차 정리
- `e4cba649` — 세션70-15: 블로그 가독성 전면 개선 + 코드 노출 수정
- `1bc5e881` — 세션70-14: 블로그 분양 템플릿 DB 풀스택 (모든 컬럼 총동원)
- `27bfa257` — 세션70-13: 리라이팅 가속 6회/일 + Sonnet 모델
- `60a492ba` — 세션70-12: 블로그 SEO 풀스택 — 내부링크 86+ 키워드
- `b46c3171` — 세션70-11: 분양/미분양 템플릿 2000자+ 개선
- `277a0a2e` — fix: 데스크탑 드롭다운 z-index 버그 수정
- `9cc8f2a0` — 세션70-10: 어드민 관심단지 관리 개선
- `4e6b92a5` — 세션70-8: 블로그 목록+상세 컴팩트 리디자인
- 세션70-7~1: 글씨크기/가독성/라이트모드/CTA/통계자료실/Excel/CSV

## 블로그 가독성 개선 (세션 70 후반)
### 코드 노출 수정
1. H2 안의 **볼드** → sanitize 파이프라인에서 제거
2. 60~70% → <del> 취소선 변환 → 숫자~숫자 이스케이프
3. TOC에 ** 노출 → extractToc 클린업
4. ## 목차 제거 (19,678편 SEO 가치 없는 H2)
5. Q&A H2→H3 다운그레이드 (normalizeMarkdownHeadings + HTML 후처리)
6. 중복 H1 숨김 (CSS first-child)

### CSS 가독성 개선
- line-height: 2.0 / opacity: 0.93
- H2 margin 36px / H3 margin 28px
- 테이블: 패딩 증가, td:first-child 볼드, hover
- 인용문: padding/margin 증가
- 라이트모드: 본문 #1a1a1a / 테이블·인용·코드 대비 강화
- 모바일 480px 최적화
- FAQ H3: 파란 좌측선+배경

### blog-rewrite 프롬프트 강화
- "## 목차" 생성 금지
- ## 안에 ** 사용 금지
- 숫자~숫자 사용 금지
- FAQ → ### 형식 명시

## SQL 즉시 재작성 결과 (4,175편)
- apt-announcement 495편 → apt_subscriptions JOIN
- stock-bulk 1,044편 → stock_quotes JOIN
- stock-dividend 726편, stock-outlook 726편
- station-apt/region/school 670편, redev/builder/sector 514편
- apt_sites 이미지/FAQ/특장점 주입: 1,090편

## 블로그 현황
- 전체: 22,663편
- 재작성 완료: 17,659편 (77.9%)
- Sonnet 리라이팅 대기: 5,004편 (54건/일, 93일 후 완료)
- 이미지 포함: 1,090편, FAQ 포함: 21,527편 (95%)

## 크론 95개 | 빌드 READY | TS 에러 0 | 런타임 에러 0
