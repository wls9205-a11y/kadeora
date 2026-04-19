# Solapi 카카오 알림톡 템플릿 — Big Event Phase 2

> 세션 139 작성 · Node가 https://console.solapi.com/kakao 에서 심사 제출.
> 각 템플릿 ID는 심사 통과 후 Vercel env에 주입.

## 공통 규칙
- **발송 채널**: 카더라 카카오 비즈 채널 (KAKAO_CHANNEL_ID)
- **본문 최대 1,000자** (공백 포함)
- **변수**: `#{변수명}` 형식, Solapi API v4 스펙 준수
- **SMS fallback**: 기본 OFF (`disableSms=true`)
- **발송 함수**: `src/lib/kakao-alimtalk.ts → sendKakaoAlimtalk(...)`
- **수신자**: Node 단일 계정 (`NODE_NOTIFY_PHONE` env)

---

## 1. SOLAPI_TEMPLATE_BIG_EVENT_NEWS

**용도**: big_event_registry에 등록된 대형 이벤트 관련 주요 뉴스 감지 시 즉시 알림

**트리거**: `/api/cron/big-event-news-detect` — 제목에 "시공사/분양/이주/착공/인가/총회/관리처분/감정평가" 포함된 기사 감지 시

**템플릿 본문**:
```
[카더라] 대형 이벤트 뉴스 감지
#{event_name} 관련 새 기사가 나왔습니다.

▶ 제목: #{title}
▶ 링크: #{url}

카더라 관리자에서 내용 확인 후 블로그 반영 여부를 결정하세요.
```

**변수**:
- `#{event_name}` — 이벤트명 (예: 삼익비치)
- `#{title}` — 기사 제목 (최대 80자)
- `#{url}` — 기사 링크 (최대 120자, 단축 권장)

**심사 주의**: 광고성 문구 금지. "관리자 알림" 톤 유지.

---

## 2. SOLAPI_TEMPLATE_DRAFT_READY

**용도**: Pillar/Spoke/D-30/D-7/D-1 자동 draft 생성 직후 검수 대기 알림

**트리거**:
- `/api/cron/big-event-auto-pillar-draft`
- `/api/cron/subscription-prebrief-generator`

**템플릿 본문**:
```
[카더라] 블로그 draft 검수 대기
#{phase} draft가 생성되었습니다.

▶ 이벤트: #{name}
▶ 지역: #{region}
▶ 슬러그: #{slug}

관리자 페이지에서 내용을 확인하고 발행 여부를 결정하세요.
```

**변수**:
- `#{phase}` — Pillar / Spoke / D-30 / D-7 / D-1
- `#{name}` — 이벤트/단지명
- `#{region}` — 지역 (시도 + 시군구)
- `#{slug}` — 생성된 draft slug

---

## 3. SOLAPI_TEMPLATE_STAGE_TRANSITION

**용도**: big_event_registry.stage가 변경될 때 Node 알림 (상향 전환)

**트리거**: 향후 `/api/cron/big-event-stage-monitor` (세션 140+ 계획)

**템플릿 본문**:
```
[카더라] 재건축 단계 전환 감지
#{event_name}의 진행 단계가 업데이트되었습니다.

▶ 이전: Stage #{old_stage} (#{old_stage_label})
▶ 현재: Stage #{new_stage} (#{new_stage_label})
▶ 감지 시각: #{detected_at}

단계 전환은 블로그 발행·리라이트 트리거입니다.
```

**변수**:
- `#{event_name}`, `#{old_stage}`, `#{old_stage_label}`, `#{new_stage}`, `#{new_stage_label}`, `#{detected_at}`

---

## 4. SOLAPI_TEMPLATE_FACT_ALERT

**용도**: fact_confidence_score 급락 (하루 -20점 이상) 감지 시 팩트 점검 요청

**트리거**: `/api/cron/big-event-fact-refresh` 실행 후 비교 로직

**템플릿 본문**:
```
[카더라] 팩트 신뢰도 급락 경고
#{event_name}의 팩트 신뢰도가 크게 떨어졌습니다.

▶ 이전: #{old_score}점
▶ 현재: #{new_score}점 (변동 #{delta}점)
▶ 주 원인: #{reason}

관련 블로그는 publish gate 자동 차단될 수 있습니다.
```

**변수**:
- `#{event_name}`, `#{old_score}`, `#{new_score}`, `#{delta}`, `#{reason}`

---

## Node 수동 심사 제출 절차

1. https://console.solapi.com/kakao → 알림톡 → 템플릿 관리
2. **채널 선택**: 카더라 공식 비즈 채널
3. **템플릿 심사 등록** (4건 모두):
   - 이름 / 본문 / 변수 순서 일치
   - 버튼 없음 (링크는 본문에 URL 변수로)
4. **심사 소요**: 평일 기준 1~3영업일
5. **통과 후 template_id 확보** → Vercel env 주입:
   - `SOLAPI_TEMPLATE_BIG_EVENT_NEWS`
   - `SOLAPI_TEMPLATE_DRAFT_READY`
   - `SOLAPI_TEMPLATE_STAGE_TRANSITION`
   - `SOLAPI_TEMPLATE_FACT_ALERT`

## 비용 추정 (월 기준)
- 중요 뉴스 알림: 이벤트 8건 × 평균 2건/월 ≈ **16건**
- Draft 알림: 주 2회 × 최대 2건 + D-30/7/1 ≈ **약 20건/월**
- Stage/Fact 알림: 이벤트 8건 × 1건/월 ≈ **16건**
- **월 예상**: ~50건 × 8.4원 = **약 420원** (VAT 별도)

## 관련 파일
- `src/lib/kakao-alimtalk.ts` — 발송 함수
- `src/app/api/cron/big-event-news-detect/route.ts` — Template 1
- `src/app/api/cron/big-event-auto-pillar-draft/route.ts` — Template 2
- `src/app/api/cron/subscription-prebrief-generator/route.ts` — Template 2
