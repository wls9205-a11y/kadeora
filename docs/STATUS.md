# 카더라 STATUS.md — 세션 54 마지막 업데이트 (2026-03-29)

## 최신 커밋
- `f833f3c` — 알림 UX 개선 (읽은 알림 삭제 + 설정 링크)
- `a33df04` — 알림 link 누락 5건 수정
- `73582cc` — 알림 중복 방지 + apt 중복 UI 제거 + 공유 바이럴 강화
- `e3c6ee8` — 실거래 통계 요약 + 미니 가격 바
- `b270e38` — 지역 분양가 현황 카드
- `ba252bc` — 분양가 시각 강화 + 납부 시뮬레이터 (빌드 에러 수정)

## 이번 세션 주요 작업 (세션 54)

### 분양가 시각화 대폭 강화
- 분양가 범위 바: 가격 등급 배지(💎🏅✨🏠🌱) + 평당가 + 글로우 마커
- 납부 시뮬레이터: 계약금/중도금/잔금 3색 비율 바 + 금액 자동 계산
- 실입주 예상 비용: 분양가+옵션가+확장비=총비용
- 분양가 vs 실거래가 비교 차트: 프리미엄/저평가 % + 범위 겹침 바
- 평형별 평당가 표시
- 핵심 지표: 규모 등급/입주까지/시행사 유형

### 모집공고 활용 강화
- 같은 시공사 다른 현장 (내부 링크)
- 공급 위치 지도 (카카오맵/네이버지도)
- 지역 분양가 현황 카드

### 알림 시스템 대수술
- 중복 방지: push-apt-deadline, push-daily-reminder 하루 1회 제한
- DB 정리: 중복 알림 726건 삭제 (847→121)
- link 누락 5건 수정 (알림 클릭 시 정확한 페이지 이동)
- 읽은 알림 삭제 기능 + DELETE API 추가
- 알림 설정 ⚙️ 링크 추가

### 중복 UI 제거
- apt/[id] 원문 보기 2→1, 지도 2→1
- 공유 바이럴 최적화 (그라디언트 배경 + 바이럴 문구)

### SEO
- article:tag: premium, hot, search 추가 (전 페이지 완료)
- 실거래 통계 서버 렌더링 (차트 로드 전 즉시 표시)

## DB 마이그레이션
- option_costs JSONB, extension_cost INT, payment_schedule JSONB, price_per_pyeong_avg INT
- price_per_pyeong_avg 5건 자동 계산 (house_type_info 기반)

## PENDING — 수동 작업
- [ ] 토스 정산 등록 (3/31 마감!)
- [ ] Anthropic 크레딧 충전
- [ ] Supabase 타입 재생성 (npx supabase gen types)
- [ ] STOCK_DATA_API_KEY 갱신 (63자 → 80~100자)
- [ ] 구글 서치콘솔 URL 색인 요청

## PENDING — 다음 세션 작업
- [ ] 옵션가/확장비/중도금 데이터 수집 크론
- [ ] nearby_facilities 데이터 수집 (5,522건 빈 {})
- [ ] APT_DATA_API_KEY → apt-backfill-details 크론 실행
- [ ] 알림 설정 개별 토글 (현재 일괄 ON/OFF)
- [ ] /apt/[id]/announcement 전용 하위 페이지 (롱테일 SEO)
