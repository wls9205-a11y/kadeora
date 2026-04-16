# 카더라 STATUS.md — 세션 113 (2026-04-17)

## 최근 배포
- **커밋**: `4c6bd141` (이미지 관련성 전면 점검 + 정화)
- **빌드**: ✅ TS 컴파일 성공 (Vercel 배포 대기)
- **프로덕션**: 정상 가동

## 이번 세션 완료 (12건)

### 이미지 관련성 + 정확도 전면 점검

#### DB 정화 (4건)
1. 경쟁사 도메인 이미지 삭제 (호갱노노 229사이트, KB부동산 68, 네이버부동산 105, 디시인사이드 114 등)
2. 단지간 3+ 중복 URL 이미지 제거 — 574사이트 (1장이 124개 단지에 붙어있는 극단적 오매칭 해소)
3. `apt_sites.images IS NULL` 336건 → `'[]'::jsonb` 정규화 (프론트 null-safe)
4. `blog_post_images` 과다중복(21+ 포스트 공유) 238장 삭제

#### 크론 개선 (2건)
5. `apt-image-crawl` 전면 재작성 (239→391줄) — DOMAIN_BLACKLIST + isRelevantToSite() + 글로벌 중복 방지 RPC + 스코프 확장 + merge 로직
6. `blog-generate-images` 블랙리스트 확장 — 경쟁사 7개 도메인 추가

#### 프론트 버그 수정 (4건)
7. `BlogHeroImage.tsx` 인덱스 버그 수정 — loadError/activeIdx 혼동 → visibleWithOrigIdx + safeActiveIdx 재설계
8. `AptImageGallery.tsx` 데스크탑 onError 누락 추가 (모바일에만 있었음)
9. `AptImageGallery.tsx` 전부-실패 시 그라데이션 폴백 UI 렌더링
10. `next.config.ts` + `BlogHeroImage` 경쟁사 도메인 제거 (hogangnono)

#### DB 인프라 (1건)
11. `get_overused_apt_image_urls` RPC 생성

#### 건설사 페이지 (1건)
12. `apt/builder/[name]` 현장 목록에 이미지 썸네일 + 폴백 추가

## 현재 상태
- **PV**: ~100건/시간
- **이미지**: 정화 완료, 재크롤 대기 (517 빈배열 + 1,319 부족)
- **블로그**: 7,730건 공개, 2,172건 실사진 커버
- **크론 에러**: 0건
- **API 키**: ANTHROPIC ✅, CRON_SECRET ✅, STOCK_DATA ✅, NAVER ✅ / KIS ❌, FINNHUB ❌, APT_DATA ❌

## PENDING
- 이미지 재크롤 수렴 모니터링 (517+1,319건 → 6~7장 목표)
- blog-generate-images 5,558건 OG→실사진 전환 속도 모니터링
- issue-draft timeout 구조적 이슈 (Vercel 300s 제한)
- Resend webhook secret 미등록
- Toss Payments 상용 MID 전환 (심사 진행 중)
