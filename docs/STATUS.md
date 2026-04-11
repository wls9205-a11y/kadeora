# 카더라 STATUS — 세션 83+ (2026-04-11 16:13 KST)

## 프로덕션
- 실유저: 66명 (24h +25)
- UV: ~2,000/일 | PV: ~2,800/일
- DB: 2.0GB/8.4GB
- 최종 커밋: d7910fbf (READY)
- 런타임 에러: 0건

## 이번 세션 완료

### CTA 전수조사 + 가입 추적 근본 수정
- content_gate: 1,343뷰 13클릭 (0.97% CTR) — 유일한 유효 CTA
- apt_alert_cta: signup_attempts 36건 → 가입 경로 1위
- login_gate: 97뷰 0클릭 → 개선 필요
- 죽은 CTA 6개 (guest_nudge/topbar/scroll/return): 이전 세션 제거 확인
- **signup_success 0건 버그 수정**: handle_new_user 트리거가 profile 먼저 생성 → isNewUser=created_at 60초 판별로 변경
- **signup_source 전원 null 수정**: 신규/기존 모두 업데이트
- 어드민 가입 퍼널 + 가입 경로 분석 섹션 추가

### 인게이지먼트 강화 (12개 파일)
- PushPromptBanner: 블로그 하단 푸시 구독 유도 (5초 딜레이)
- ProfileCompleteBanner: 피드 상단 프로필 완성 유도 (+50P)
- /api/profile/complete-bonus: 프로필 첫 완성 보너스 +50P
- 프로필 저장 시 profile_completed 자동 설정
- 출석 보너스 강화: 3일+15P, 7일+50P, 14일+80P, 30일+150P
- 첫 댓글 보너스 +20P
- Newsletter API: is_active + 전환 추적
- 게이트 내 공유 버튼 추가 (비로그인 공유 가능)

### 어드민 개편
- 가입 경로 분석 (소스별 시도/성공/전환율)
- 위험 신호 강화: 공유 죽음, 가입성공 0건, 미활성 유저, 푸시 3명
- neverActive 메트릭

## PENDING
- [ ] 카카오 채널 메시지에 앱 딥링크 추가
- [ ] A/B 테스트 (게이트 CTA 문구)
- [ ] 블로그 체류시간 추적
- [ ] SEO rewrite 재개 (10,400 → 15,000)
- [ ] login_gate 0% CTR 개선
