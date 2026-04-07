# 카더라 STATUS.md
> 최종 업데이트: 세션 78 | 2026-04-08

## 시스템 현황

| 항목 | 값 |
|------|-----|
| 실 유저 | 42명 |
| 블로그 | ~39,394편 |
| 주식 종목 | 1,805 |
| 부동산 현장 | 2,702 (apt_sites 5,758) |
| 크론 | 72개 |
| PV (일) | ~834 |
| 가입 (7d) | 15명 |

## 세션 78 완료 작업

### CTA 시스템 재설계
- 기존 12개 CTA → 2개로 통합 (InlineCTA + StickyBar)
- SmartSectionGate 헤딩 12→25개 확장
- CTA A/B 테스트 (주식 메시지 2개 variant)

### 어드민 대시보드 개선
- 가독성 77건 수정 (C.bg→C.surface, fontSize 9→10)
- 컴팩트화 + CTA 퍼널 실데이터 연동
- FocusTab 성장 분석 패널 (유저건강도/리텐션/CTA퍼널)
- v2 API 8개 성장 필드 추가
- 7개 자동 진단 경고

### 성장 전략 구현
- DB 트리거: 시드 댓글 알림 하루 3건 제한
- 주식 크론 빈도 상향 (blog-stock-v2 3h, blog-stock-cluster 4h)
- welcome-nudge 크론 (D+1/D+3 맞춤 알림)
- health-check Anthropic API 크레딧 감지

### 첫 미션 시스템
- DB: first_mission_completed, first_mission_progress 컬럼
- FirstMissionBanner: 피드 상단 4개 미션 (종목/현장/게시글/댓글)
- 2개+ 완료 시 보너스 200P
- CommentSection/WriteClient에서 자동 미션 완료 감지

### 프로필 완성 인센티브
- DB: profile_completion_rewarded 컬럼
- ProfileCompletionBar: 피드 상단 완성도 바
- 5단계 완성 시 200P 자동 지급

### 코드 정리
- 41파일 100건 리팩토링 (상수화/중복 제거)
- 피드 자동발행 (주식35%/부동산30%, 2시간마다 4~7개)
- SEO 감사 빌드 에러 5건 수정

## PENDING

- [ ] Anthropic API 크레딧 충전 (console.anthropic.com) ← 긴급
- [ ] 어드민 대시보드 전면 재구축 (ADMIN_REDESIGN_V3.md)
- [ ] 온보딩 푸시 동의 단계 추가
- [ ] 주간 이메일 다이제스트
- [ ] SEO 리라이트 Phase 0~4

## API 키 상태
| 키 | 상태 |
|-----|------|
| ANTHROPIC_API_KEY | ❌ 크레딧 소진 |
| CRON_SECRET | ✅ |
| STOCK_DATA_API_KEY | ✅ |
