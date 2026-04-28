# 2026-04-27/28 SEO 마스터 + 회원가입 Funnel 회복 회고

## 배경

이슈선점 블로그 시스템 점검 요청 → 진단 결과 SEO 인프라/콘텐츠 위생 회복 + 회원가입 funnel 추가 점검 → CTA 추적 회귀 + 모바일 OAuth callback 깨짐 발견 → 12개 작업 한 deploy로 통합 fix.

## 8 세션 타임라인

| 세션 | 핵심 변경 | 효과 |
|---|---|---|
| s189 | SEO 풀스택 마스터 인프라 | 백필 7,117건 100% 위생 |
| s190 | publish gate 임계값 완화 + Phase 2 디버그 | gate_blocked 100→25% |
| s191 | image=0 부작용 청산 + admin run-pipeline | 7d image≥5 94.7% |
| s192 | vercel crons 104→100 + orchestrator | 빌드 통과 + Phase 2 가동 |
| s193 | orchestrator 가동 + image-attach 가속 | 백로그 1,488 → 202 |
| s194 | image-attach 무한 retry fix | retry≥3 자동 제외 1,280 |
| s195 | silent fail 전수 fix | 진단 로그 + 강제 enrich |
| s196 | CTA + signup funnel 비약 회복 | trackCTA keepalive + 12 작업 |

## 핵심 발견 (데이터 진단)

### 4/18 이후 8개 CTA 가입 attempts 0건
- apt_alert_cta (67 → 0)
- blog_inline_cta (27 → 0)
- action_bar (25 → 0)
- content_gate / sidebar / login_gate_blog_compare / login_gate_apt_ongoing_alert / content_lock
- 누적 138건/일 잠재 가입이 사라짐
- 원인: trackCTA fetch 호출 시 페이지 unload 직전 발화 → 요청 abort. keepalive: true로 fix.

### 모바일 OAuth callback 75% drop
- 28건 oauth_start drop 중 21건이 mobile_native
- oauth_callback_at NULL = callback URL 미수신
- isMobile 진단 로그 추가 + Supabase Auth Provider redirect URL 점검 필요

### /stock 페이지 50% CTR but 노출 8건
- popup_signup_modal 유일 작동 (4.09% CTR /blog/*)
- /stock으로 확장 → 일 가입 5~10건+ 추가 기대

### Engagement 매트릭스 결정적
- apt 1-2 보고 + blog 2+ 본 사용자: **18.92% 가입률**
- 그러나 그런 유저 37명만 — 일반 visitor는 1-2 apt만 보고 떠남
- Progressive CTA 도입 (apt 5+ → 강력 CTA)

## 통합 효과 (인프라 + 백필 vs 신규 발행)

| 영역 | 인프라 | 백필 | 신규 발행 |
|---|---|---|---|
| meta_desc | ✅ | 100% | ⚠️ 검증 대기 |
| image_alt | ✅ | 100% | ⚠️ 검증 대기 |
| hub-spoke 매핑 | ✅ | 7,238 | ❌ 7% (s195 fix 검증 대기) |
| image≥5 | ✅ | 7d 94.7% | ❌ 1h 44.2% (silent fail) |
| 외부 EAT | ✅ | - | ⚠️ 66% |
| 데이터 출처 섹션 | ✅ | - | ❌ 14% |
| 관련 정보 footer | ✅ | - | ❌ 11% |
| FAQ | ✅ | - | ✅ 100% |
| Speakable schema | ✅ | - | ✅ |
| News sitemap | ✅ | - | ✅ 응답 200 |

신규 발행글 silent fail은 s195가 fix했지만 detect 504로 큐 EMPTY 상태에서 자연 검증 어려움. 강제 검증용 reset 2건 처리 후 결과 봐야.

## Lessons learned

1. **CTA 트래킹 회귀는 silent — 명시 health check 필요**
   - 4/18 변경에서 8개 CTA 깨졌는데 알람 없음 → v_cta_health_check 뷰로 BROKEN/DEAD 자동 분류

2. **백필과 신규 코드는 별도 검증 필요**
   - 백필 100%여도 신규 코드가 동일 효과 보장 X (issue-publish OG padding silent fail 사례)

3. **무한 retry 루프는 데이터 마커로 차단**
   - daily_limit 같은 환경 가드는 코드 변경 없이 retry_count 99 마킹으로 자연 해소

4. **Vercel cron 100 한도는 합치기로 해결**
   - individual cron 4개를 orchestrator 1개로 통합 → 순감 3개

5. **다른 컴퓨터 동시 작업은 rebase로**
   - abe25967 (og-blog fix), 1b255d0f, 480bfb74 모두 conflict-free 머지

## 다음 단계 (자연 안정화 대기)

- s196 효과 30분 / 1h / 3h / 24h 측정 일정대로 검증
- 검증 결과 따라 추가 fix 또는 완료 판정
- 미해결 이슈 우선순위:
  1. 신규 발행글 hub link 0% (s195 fix 효과 자연 검증)
  2. issue-detect 504 간헐
  3. og-blog/og-apt 잔존 TypeError
