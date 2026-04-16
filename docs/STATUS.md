# 카더라 STATUS.md — 세션 112 (2026-04-16)

## 최근 배포
- **커밋**: `656d0e4a` (SEO 전수조사 8건 수정 + /about/team 제거)
- **빌드**: ✅ 성공
- **프로덕션**: 정상 가동

## 이번 세션 완료 (22건)

### 피드 시스템
1. 피드 일상+콘텐츠 템플릿 강화 (6→16 casual, 12 content 추가)
2. 피드 동적 데이터 소스 5→9개 확장 (청약D-day, 뉴스, 트렌딩, 고가실거래)
3. 시간당 4건+ 자동발행 (매시간 × 4~5건 = 68~85건/일)
4. 오래된 정보 차단 (AI 프롬프트 KST 날짜 주입 + 폴백 7건 수정)
5. "제목:" 접두사 파싱 강화 (regex 개선 + DB 정리)
6. 하드코딩 7건 제거 (마트물가/복리/커피/금리/절약/카드/OTT)

### 어드민
7. 대시보드 개선 5건 (PV+UV+어제대비, 실시간방문자, 14일추이, 콘텐츠파이프라인, 중복제거)
8. 최신화 버튼 elapsed 표시 (✓153 · 12.3s)
9. god-mode 크론 누락 0건 확인

### 부동산
10. 단지백과 히어로+KPI 제거 → 심플 헤더
11. 부동산 썸네일 동기화 (+1,636건 복원 + Phase 0)
12. 이미지 재수집 (빈배열 7,444건 리셋 + apt-image-crawl 스케줄 등록)
13. 실거래 검색 500 에러 수정 (or(ilike) → RPC 전환)

### 블로그
14. 이미지 정확도 개선 (sub_category 14개 쿼리 + 도메인 필터 12개)
15. A2 강제발행 버그 수정 + ghost 47건 복구
16. blog-quality-score 공개글 미채점 수정

### 이슈 파이프라인
17. [선점분석] 접두사 제거 (코드+템플릿+DB 28건)

### SEO 전수조사 (8건 수정)
18. robots.txt /shop/ Disallow 해제
19. stock/compare + apt/diagnose metadata 추가
20. GEO 메타태그 추가 (geo.region=KR, ICBM)
21. sitemap 정리 (/shop 추가, noindex 페이지 제거, /about/team 제거)
22. privacy/terms/refund OG 추가 + twitter:site 글로벌 설정

### 기타
- /shop 비즈니스 정보 수정 (${BIZ_NAME} → {BIZ_NAME})
- /about/team 페이지 완전 삭제
- 토스페이먼츠 답장 이메일 작성
- TS 빌드 에러 수정 (extractKeywords string|null)

## 현재 상태
- **PV**: ~100건/시간
- **이미지 수집**: 27,302/34,539 (79%) — 크론 3개 자동 처리 중
- **블로그**: 7,716건 공개, 2,181건 실사진 커버
- **피드**: 61건/24시간 자동발행
- **크론 에러**: 0건
- **API 키**: ANTHROPIC ✅, CRON_SECRET ✅, STOCK_DATA ✅, NAVER ✅ / KIS ❌, FINNHUB ❌, APT_DATA ❌

## PENDING
- 이미지 수집 완료 대기 (~6,489건, ~2시간 남음)
- issue-draft timeout 구조적 이슈 (Vercel 300s 제한)
- Resend webhook secret (RESEND_WEBHOOK_SECRET) 미등록
- Toss Payments 상용 MID 전환 (심사 진행 중)
