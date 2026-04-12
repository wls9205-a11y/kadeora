# 카더라 STATUS.md
> 마지막 업데이트: 2026-04-12 21:30 KST (세션 90)

## 세션 90 — 리텐션 시스템 Phase 1

### 완료

1. **소셜 실시간 푸시** — 댓글/좋아요/팔로우 시 상대방에게 웹 푸시 즉시 발송 (리텐션 핵심 루프)
2. **앱 배지 API** — SW에서 `setAppBadge()`/`clearAppBadge()` 호출 (PWA 아이콘에 미읽음 표시)
3. **/api/push/click** — 푸시 클릭 추적 엔드포인트 (SW 404 해소 + CTR 측정 기반)
4. **Quiet Hours** — `isQuietHours()`, `filterActiveUsers()` push-utils에 추가
5. **push-content-alert** — `notification_settings.push_hot_post` 옵트아웃 체크 + OG 이미지 포함
6. **PushPromptBanner 삭제** — SmartPushPrompt로 통합 (blog/[slug] 중복 배너 해소)
7. **출석 알림** — `link: '/attendance'` 추가 (클릭 시 출석 페이지로 이동)
8. **blog-subscription-alert** — 블로그 생성 후 `sendPushBroadcast()` 추가
9. **admin OpsTab** — 푸시 발송 성과 대시보드 (CTR/구독수/읽음률/최근 로그)
10. **admin v2 API** — `pushStats` 통계 (push_logs 기반) + SOLAPI 키 상태
11. **설계 문서** — `docs/RETENTION_SYSTEM_DESIGN.md` (1,112줄, Phase 1~3 전체 설계)

### 배포

### 핵심 아키텍처
- **원칙:** "데이터가 없으면 발행하지 않는다"
- **품질 게이트:** 70점+ pass, S(90+)/A(80+)/B(70+)/C(50+)/F
- **크론 정비:** 31개 → 24개 (유지12+교체8+신규4, 비활성화11)
- **콘텐츠 4타입:** TYPE A(단지분석), TYPE B(종목분석), TYPE C(카더라 선점), TYPE D(재테크 가이드)
- **이미지 3층:** 자체 인포그래픽 + 공신력 이미지(조감도) + Unsplash

### 완료 작업 요약

#### SEO 메타데이터 (36파일)
- buildMeta v2, og-square 자동, max-image-preview, BUILD_DATE 고정
- 29개 페이지 og-square/naver:description/timestamp 안정화
- JSON-LD 추가 (stock/compare, search, press BreadcrumbList)
- stock/compare SSR 전환 (CompareClient 분리)
- discuss/search SSR H1, apt/unsold redirect 정리

#### UX 개선
- 더보기 메뉴 15→22항목, 5그룹, sub 설명, 터치타겟 확대
- 피드 tag 직접링크, readingTime 350, alt, 폰트 확대
- 글쓰기 FAB 전환 → 하단탭 5개 균등배치
- ScrollToTop ↔ FAB 겹침 해결
- 글쓰기 페이지 디자인 개선 (제목 20px/800, 본문 16px)

#### 블로그 이미지 시스템
- Unsplash API 통합 (UNSPLASH_ACCESS_KEY 등록)
- 22,809개 이미지 배치 (7,603개 × 3장 캐러셀)
  - Position 0: Unsplash 실사진 (카테고리별 8장 라운드로빈)
  - Position 1: OG 인포그래픽 (데이터 카드)
  - Position 2: Unsplash 서브 사진
- BlogHeroImage: 스와이프, 좌우 화살표, 1/3 카운터, 도트 네비
- 크론: blog-generate-images 하루 4회 (02/08/14/20 UTC)
- OG 텍스트카드 히어로 제거 → blog_post_images만 렌더

#### UI 전수조사 표준화 (105파일, 518줄)
- fontSize: 8-9px → 10px (최소 가독성, 62건)
- borderRadius: 하드코딩 → CSS 변수 (radius-sm/md/card/lg/xl/pill)
- padding: 2px 6px → 3px 8px (뱃지 최소 크기)
- gap: 홀수 → 짝수 (3→4, 5→6)
- 터치 타겟: 24x24→28x28, 28x28→32x32 (접근성)
- Feed/Blog/Navigation 세부 조정

### 배포
- ✅ READY (dpl_7VQFEYnuxHEjaTpevTN5vGJiNYPw)
- 런타임 에러 0건

### 미실행 (다음 세션)
- /api/blog-chart 데이터 시각화 이미지 (시세 추이, 지역 비교)
- ItemList/SpeakableSpecification JSON-LD
- SSR 서술형 분석 텍스트 (Thin Content 해소)
- Last-Modified 헤더 (middleware)
- 어드민 FocusTab SEO 위젯
- SEO_REWRITE_PLAN 실행 (59K→15K)


### 다음 세션 작업 (리텐션 Phase 2)

1. **[선행] Resend 도메인 DNS 인증** — SPF/DKIM/DMARC (Hostinger DNS)
2. **DB 마이그레이션** — notification_settings 확장 + notification_dispatch_logs + notifications 보강
3. **notification-hub.ts** — 중앙 알림 허브 (cascade 레벨 분기: urgent/routine/critical)
4. **streak-alert 크론** — 21:00 KST 스트릭 위기 알림
5. **churn-prevention 크론** — D+3 푸시 / D+7 이메일 / D+14 전채널
6. **email-digest 크론** — weekly-digest 대체 + Resend 실제 이메일 발송
7. **pending-notification-dispatch 크론** — 2분마다 번들링 ("OO님 외 N명" 합침)

### Phase 1 변경 파일 (15개)
```
A  docs/RETENTION_SYSTEM_DESIGN.md
M  public/sw.js
M  src/app/(main)/blog/[slug]/page.tsx
M  src/app/(main)/notifications/page.tsx
M  src/app/admin/tabs/OpsTab.tsx
M  src/app/api/admin/v2/route.ts
M  src/app/api/attendance/route.ts
M  src/app/api/comments/route.ts
M  src/app/api/cron/blog-subscription-alert/route.ts
M  src/app/api/cron/push-content-alert/route.ts
M  src/app/api/follow/route.ts
M  src/app/api/likes/route.ts
A  src/app/api/push/click/route.ts
D  src/components/PushPromptBanner.tsx
M  src/lib/push-utils.ts
```

### 핵심 아키텍처
- **원칙:** "데이터가 없으면 발행하지 않는다"
- **품질 게이트:** 70점+ pass, S(90+)/A(80+)/B(70+)/C(50+)/F
- **크론 정비:** 31개 → 24개 (유지12+교체8+신규4, 비활성화11)
- **콘텐츠 4타입:** TYPE A(단지분석), TYPE B(종목분석), TYPE C(카더라 선점), TYPE D(재테크 가이드)
- **이미지 3층:** 자체 인포그래픽 + 공신력 이미지(조감도) + Unsplash
- **리텐션:** 소셜 실시간 푸시 + 앱 배지 + Quiet Hours + 멀티채널 cascade (Phase 2~3)
