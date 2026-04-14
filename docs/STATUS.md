## 세션 109 — CTA 전략 전면 재설계 + SEO 28항목 수정

### 커밋: c5f55080 (CTA), 5ef2086a (SEO) — push 대기
### 변경: 19파일 총, +303 -90

### CTA 전략 재설계 (12파일)

핵심 전환: "텍스트 잠금 → 알림 서비스" 가치 제안 전환

**Phase 1 — CTA 카피 전환:**
- SmartSectionGate: "나머지 분석 이어 읽기" → "가격이 변하면 알려드릴게요", 게이트 20-50% → 40-70%
- BlogMidCTA: 부활 (import 0→1), 서비스 지향 카피, unsold/redev 카테고리 추가
- BlogFloatingBar: 신규 컴포넌트 — 스크롤 30% 후 고정 [저장/알림/공유] 바
- KakaoHeroCTA: "3초 가입 인사이트" → "관심 지역·종목 가격 변동 알림"
- LoginGate/CalcSignupCTA/page.tsx: 전체 CTA 버튼 "가입" → "알림 설정" 통일

**Phase 2 — 온보딩 재설계:**
- auth/callback: CTA 가입자 온보딩 스킵 제거 → 모든 신규 유저 /onboarding 필수
- OnboardingClient: 관심 설정 완료 시 auto-alerts API 호출 추가
- api/onboarding/auto-alerts: notification_settings + email_subscribers 자동 등록
- ProfileCompleteBanner: "프로필 완성 +50P" → "관심 설정하면 맞춤 알림" 전환

### 근거 데이터
- 실제 유저 102명 중 90명(88%) 가입 후 활동 0건 (유령)
- price_alerts 등록: 0건, push_subscriptions: 7명
- 원인: CTA 가입 → onboarded=true 자동 설정 → 온보딩 스킵 → 관심 미설정 → 알림 안 받음 → 재방문 0

### SEO 28항목 수정 (7파일 + DB 6건)
(이전 커밋 5ef2086a에 포함)

---

## 세션 108 — 전체 감사 24건 + 어드민 대시보드 업데이트

### 3차 심층 감사 결과 총 24건 발견 → 13건 코드 수정 완료

#### CRITICAL 수정 완료
1. ✅ admin/v2 `issue_alerts.alert_type` → `issue_type` (DB 에러 해소)
2. ✅ search API `vote_yes/vote_no` → `vote_a/vote_b` (토론 검색 복구)
3. ✅ `apt-analysis-gen` withCronAuth 추가 + batch 15→5 + 250s timeout + 스케줄 매시간→6시간
4. ⚠️ `/apt/두산위브...` "Objects are not valid as React child" — 단발성, 모니터링 중
5. ⚠️ DB statement timeout — 무거운 쿼리 모니터링 중

#### HIGH 수정 완료
6. ✅ seed-posts 모듈레벨 today/hourKST/isWeekend → `getDateVars()` 함수화
7. ✅ 5개 탭 + ComplexClient `design=2` → `(i%6)+1` 로테이션
8. ✅ collect-site-images 실패 사이트 `images:[]` 마킹 (API 낭비 차단)
9. ✅ redev-enrich + apt-price-sync 타임아웃 방어 (100s 체크)

#### MEDIUM 수정 완료
10. ✅ unsold tab-data API + page.tsx에 `ai_summary` 컬럼 추가
11. ✅ TransactionTab에 EngageRow import + aptEngageMap prop 전달
12. ✅ issue-draft 스케줄 `*/10` → `*/30` (API 호출 66% 감소)

#### 어드민 대시보드 업데이트
13. ✅ 🖼️ 부동산 이미지 수집 진행률 섹션 추가 (apt_sites + 단지백과)
14. ✅ 크론 슬롯 89 → 91 정확한 수치 반영 (v2 API + OpsTab + FocusTab)
15. ✅ imageCollection 쿼리 추가 (NULL/빈배열 구분 정확 집계)

### 남은 모니터링 항목
- apt-analysis-gen: 6시간 간격으로 정상 완료되는지 확인 필요
- collect-complex-images: 34,539개 단지 이미지 수집 진행 중 (매시간 500건)
- collect-site-images: ~228개 실패 사이트 images:[] 마킹 후 API 낭비 차단 확인

### 프로덕션 상태
- 배포: READY ✅
- TypeScript 에러: 0건
- 런타임 에러: 0건 (최근 10분)
- 크론 슬롯: 91/100
