# 카더라 STATUS — 세션 84 (2026-04-12 00:30 KST)

## 프로덕션
- 실유저: 66명 (24h +25)
- UV: ~2,000/일 | PV: ~2,800/일
- DB: 2.0GB/8.4GB
- 최종 커밋: d7910fbf (READY)
- 런타임 에러: 0건

## 이번 세션 완료

### 호스팅어 사이트 긴급 복구
- **CDN Security "I'm under attack!" 발견** → 네이버/Google 봇 403 차단의 근본 원인 → Low로 변경하여 해결
- **분양권실전투자.com wp-login.php 0바이트** 복구 (급매물.com에서 복사)
- **분양권실전투자.com .htaccess 비어있음** → 워드프레스 rewrite 규칙 복구
- **4개 추가 사이트 wp-login.php 0바이트** 일괄 복구 (julin2.com, stockcoin.net, xn--6w6btrz4g.com, xn--hc0bu2j9no16cctc.com)
- **호스팅어 Malware Scanner 오탐** 확인: 2026-04-04에 112개 파일 삭제 (class-wp-image-editor-imagick-hooks.php 등)
- 108개 사이트 CDN Security level 일괄 Low 변경 필요 → 호스팅어 고객지원에 요청 권장

### CTA 전면 분석 & 개선 (7개 파일)
- **BlogMidCTA 타겟 반전**: 로그인 유저 → 비로그인 유저 (기존: 이미 가입한 사람에게 "무료로 시작하기" 노출하는 오류)
- **BlogMidCTA 리디자인**: 카테고리별 혜택 리스트 + 다크 카드 + trackConversion 적용
- **ActionBar 딜레이 단축**: 3초 → 1초 (97.5% 바운스율 대응, 이탈 전 노출)
- **SmartSectionGate 커트 완화**: 40% → 55% (충분히 읽혀야 "더 보고 싶다" 발생) + CTA 문구 "이어서 읽기"로 변경
- **LoginGate 개선**: 가치 미리보기 텍스트 추가 (적정가: ???원 | 리스크: ?단계) — 0% CTR 대응
- **RelatedContentCard 가입 CTA 추가**: showSignup prop → 비로그인 시 "🔔 무료 가입하고 알림 받기" 링크 노출
- **어드민 GrowthTab CTA 대시보드 강화**: 총 노출/클릭/CTR 요약 카드 + 상태 아이콘(🟢>2%/🟡>0.5%/🔴) + 15개까지 확장

### 어드민 대시보드 전면 개편
- **FocusTab 629줄 → 433줄** (-31%): 모놀리식 코드 정리, 섹션 14개로 재구성
- **탭 통합 7개 → 6개**: ExecuteTab god-mode를 대시보드 🚀 원버튼으로 통합
- **벤치마크 기준표 8항목 도입**: CTR/가입률/크론/DB/게이트/프로필/알림/재방문 — 각각 🟢🟡🔴 상태 표시
- **경고 배너 자동생성**: 기준점 이하 항목 자동 감지 → 빨간 경고 카드 노출
- **전환 퍼널 시각화**: PV→UV→게이트노출→게이트클릭→가입시도→가입성공 6단계 + 이탈률
- **KST 이중변환 버그 수정** (Growth 시간대 +18시간)
- **kpi/extended 필드 매핑 9건 수정** (signupAttempts/gateViews/shares 0표시 버그)

## PENDING
- [ ] 호스팅어 108개 사이트 CDN Security → Low 일괄 변경 (고객지원 요청)
- [ ] SSH 비밀번호 변경 (채팅에 노출됨)
- [ ] 네이버 서치어드바이저 사이트맵 재제출 (CDN 차단 해제 후)
- [ ] Google Search Console 수동 조치 확인
- [ ] A/B 테스트 (SmartSectionGate 55% vs 60% 커트포인트)
- [ ] 블로그 체류시간 추적
- [ ] SEO rewrite 재개 (10,400 → 15,000)
