# 카더라 STATUS.md
> 최종 업데이트: 세션 78 | 2026-04-07 17:06

## 시스템 현황

| 항목 | 값 |
|------|-----|
| 실 유저 | 42명 (가입 후 활동 0%) |
| 블로그 | ~39,394편 |
| 주식 종목 | 1,805 |
| 부동산 현장 | 2,702 (apt_sites 5,758) |
| 크론 | 72개 |
| PV (일) | ~834 |
| 가입 (7d) | 15명 |

## 세션 78 작업 완료

### 1. CTA 시스템 완전 재설계
- 기존 12개 CTA → 2개로 통합 (InlineCTA + StickyBar)
- 모든 페이지에 배치 (stock/apt/blog/feed)
- SmartSectionGate 헤딩 12→25개 확장

### 2. 하드코딩/중복 코드 100건 리팩토링
- constants.ts에 CONTACT_EMAIL/PHONE, AI_MODEL 등 상수화
- 41파일 100건 수정

### 3. 피드 자동발행 개선
- 주식 35%, 부동산 30%, 뻘글 25%, 동네 10%
- 2시간마다 4~7개 (하루 48~84개)

### 4. 어드민 대시보드 개선
- 컴팩트화 (KPI/차트/패딩 축소)
- 하드코딩 제거 77건 (C.bg→C.surface, fontSize 9→10)
- FocusTab 성장 분석 패널 추가 (유저건강도/리텐션/CTA퍼널)
- "전환" → "CTA" 라벨 명확화

### 5. 성장 전략 1차 구현
- DB 트리거: 시드 댓글 알림 하루 3건 제한
- 주식 크론 빈도 상향: blog-stock-v2 3시간, blog-stock-cluster 4시간
- welcome-nudge 크론 신규: D+1/D+3 맞춤 알림
- health-check: Anthropic API 크레딧 자동 감지

### 6. 종합 성장 전략 + 어드민 설계안
- docs/GROWTH_STRATEGY_V1.md: 7개 문제 + 해결책 + 구현 우선순위
- docs/ADMIN_REDESIGN_V3.md: 어드민 전면 개편 설계안

## PENDING 작업

### 즉시 (코드 변경)
- [ ] Anthropic API 크레딧 충전 (console.anthropic.com)

### 1주 내
- [ ] 첫 미션 시스템 (온보딩 후 미션 팝업 + 포인트)
- [ ] 온보딩에 푸시 동의 단계 추가
- [ ] 프로필 완성 인센티브 (200P)
- [ ] 가격 변동 알림 크론 (종목 ±3%, 청약 D-7)

### 2주 내
- [ ] 주간 이메일 다이제스트
- [ ] CTA A/B 테스트 시스템
- [ ] 어드민 대시보드 전면 재구축 (ADMIN_REDESIGN_V3.md 기반)
- [ ] SEO 리라이트 Phase 0~4 (docs/SEO_REWRITE_PLAN.md)

## API 키 상태
| 키 | 상태 |
|-----|------|
| ANTHROPIC_API_KEY | ❌ 크레딧 소진 |
| CRON_SECRET | ✅ |
| STOCK_DATA_API_KEY | ✅ |
| KIS_APP_KEY | ❌ |
| FINNHUB_API_KEY | ❌ |
| APT_DATA_API_KEY | ❌ |
