# 카더라 STATUS.md — 세션 55 후반 (2026-03-30 04:00 KST)

## 최신 HEAD
- `74244d5` — 공공데이터 API JSON 파싱 에러 방어
- `1b77ea2` — apt-crawl-pricing maxDuration 300초 + 배치 250건
- `0f58fe2` — 가격 단위 버그 수정 (만원 단위 통일)

## 분양가 자동 수집 현황
- **347/2,692건 (12.9%)** 수집 완료
- **매시간 250건** 자동 수집 (maxDuration 300초)
- **약 10시간 후 전체 완료** 예상 (2026-03-30 14:00 KST)
- 평당가: 175건 보유 (자동 계산)

## 이번 세션 핵심 작업

### 가격 시각화 (8개 페이지 강화)
- apt/[id]: 지역 시세 비교 포지션 바 + 미공개 참고 시세
- apt/complex/[name]: 월별 시세 추이 SVG 차트
- apt/region/[region]: 청약 분양가 + 실거래 평당가
- apt/search: 미니 가격 바
- SubscriptionTab/UnsoldTab/OngoingTab: 분양가 범위 바

### 가격 단위 버그 수정 (심각)
- tier 기준: 원→만원 (12억 현장이 "3억 미만" 표시 → 수정)
- fmtA 인라인 2개 제거 → fmtAmount 통일
- 납부 시뮬레이터 basePrice 단위 혼재 수정

### 크론 개선 (3개 신규, 3개 강화)
- apt-crawl-pricing: 매시간 250건, maxDuration 300초
- apt-price-sync: 매일 03시, 3개 소스 싱크
- apt-backfill-details: 주1→매일 04:30
- 3개 크론 JSON 파싱 방어 강화 (busan-redev, crawl-pricing, backfill-details)

## PENDING
- [ ] Anthropic 크레딧 충전 (블로그 크론 0건)
- [ ] 분양가 수집 완료 후 크론 스케줄 6시간으로 복원
- [ ] nearby_facilities 데이터 (카카오/네이버 API 필요)
