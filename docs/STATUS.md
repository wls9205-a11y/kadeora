# 카더라 STATUS — 세션 83+ (2026-04-11)

## 프로덕션
- 실유저: 66명 (24h +25)
- UV: ~2,000/일 | PV: ~2,800/일
- DB: 2.0GB/8.4GB

## 이번 세션 완료

### 블로그 전환 극대화
- SmartSectionGate v3: 완전 불투명 게이트, 첫 글부터 적용
- 청약/종목 알림 CTA: 본문 첫 H2 앞 주입
- 카카오톡 공유 + 추적
- 게이트 내 공유 버튼 추가 (링크복사+공유)
- 인기글 위젯, 하단 중복 5개 제거

### 가입 추적 시스템
- signup_attempts 테이블 + API
- auth/callback 근본 수정 (isNewUser 60초 판별)
- signup_source 저장 버그 수정
- 어드민 가입 퍼널 카드 (시도/성공/실패)
- 가입 경로 분석 (소스별 시도/성공/전환율)

### 인게이지먼트 강화
- 출석 보너스 강화 (3일+15, 7일+50, 14일+80, 30일+150)
- 첫 댓글 보너스 +20P
- 프로필 완성 보너스 +50P (profile_completed 자동 설정)
- ProfileCompleteBanner (피드 상단)
- PushPromptBanner (블로그 하단, 로그인 유저)
- Newsletter is_active + 전환 추적

### 버그 수정
- 회원가입 500 에러 (email_subscribers 트리거)
- 출석 버그 (profiles.last_checked_date)
- 이미지 업로드 오류 (images 버킷 생성)
- 모바일 블로그 CSS
- default-unsold.webp 168건 OG 이미지 교체

### 어드민
- 가입 퍼널 최상단 3열
- 가입 경로 분석 섹션
- neverActive/공유/가입성공/푸시 위험 신호
- 게이트 전환 카드
- 가독성 10개 항목 개선

## PENDING
- [ ] 카카오 채널 메시지에 앱 딥링크 추가
- [ ] A/B 테스트 (게이트 CTA 문구)
- [ ] 블로그 체류시간 추적
- [ ] SEO rewrite 재개 (10,400 → 15,000)
