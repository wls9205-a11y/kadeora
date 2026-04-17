# 카더라 STATUS.md — 세션 113 (2026-04-17)

## 최근 배포
- **커밋**: `af3400cb` (null 렌더링 전수 점검 + 504 타임아웃 수정)
- **빌드**: ✅ TS 컴파일 성공
- **프로덕션**: 정상 가동 (apt-image-crawl 504 수정 배포됨)

## 이번 세션 완료 (20건)

### DB 정화 (4건)
1. 경쟁사 도메인 이미지 삭제 (호갱노노/KB/네이버부동산/디시인사이드 등)
2. 단지간 3+ 중복 URL 이미지 제거 — 574사이트 (최대 124단지 동일 이미지)
3. `apt_sites.images IS NULL` 336건 → `'[]'::jsonb` 정규화
4. `blog_post_images` 과다중복 238장 삭제

### 크론 개선 (3건)
5. `apt-image-crawl` 전면 재작성 (239→405줄) — DOMAIN_BLACKLIST + isRelevantToSite() + 글로벌 중복 방지 RPC + 스코프 확장
6. `apt-image-crawl` 504 타임아웃 수정 — BATCH 100→30 + MAX_RUNTIME_MS 250초 가드
7. `blog-generate-images` 블랙리스트 확장 — 경쟁사 7개 도메인 추가

### 프론트 버그 수정 (4건)
8. `BlogHeroImage.tsx` loadError/activeIdx 인덱스 혼동 → visibleWithOrigIdx + safeActiveIdx
9. `AptImageGallery.tsx` 데스크탑 onError 누락 + 전부-실패 폴백 UI
10. `next.config.ts` + `BlogHeroImage` 경쟁사 도메인(hogangnono) 제거
11. `apt/builder/[name]` 현장 목록 이미지 썸네일 + 폴백 추가

### null 렌더링 전수 점검 (8건)
12. `compare/[slugs]` sigungu null → "서울 null" 방지
13. `theme/[theme]` 목록 아이템 sigungu null 방지
14. `ComplexClient` React key + hero-addr null sigungu
15. `TransactionTab` 바텀시트 지역 표시 filter(Boolean).join
16. `DailyReportClient` KPI 카드 sigungu/sector undefined 방지
17. `daily-report-data` guPrices null sigungu 필터
18. `daily-report-data` hotDeals sigungu || '' 폴백
19. `daily-report-data` unsoldLocal null sigungu_nm 필터

### DB 인프라 (1건)
20. `get_overused_apt_image_urls` RPC 생성

## 현재 상태
- **PV**: ~100건/시간
- **이미지**: 정화 완료, 재크롤 대기 (517 빈배열 + 1,319 부족)
- **블로그**: 7,730건 공개, 2,172건 실사진 커버
- **크론 에러**: apt-image-crawl 504 수정 배포됨 (다음 매시 실행에서 확인)
- **API 키**: ANTHROPIC ✅, CRON_SECRET ✅, STOCK_DATA ✅, NAVER ✅ / KIS ❌, FINNHUB ❌, APT_DATA ❌

## PENDING
- apt-image-crawl 504 수정 후 정상 동작 확인 (다음 매시 크론)
- 이미지 재크롤 수렴 모니터링 (517+1,319건 → 6~7장 목표)
- blog-generate-images 5,558건 OG→실사진 전환 속도 모니터링
- issue-draft timeout 구조적 이슈 (Vercel 300s 제한)
- Resend webhook secret 미등록
- Toss Payments 상용 MID 전환 (심사 진행 중)
