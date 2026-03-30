# 카더라 STATUS.md — 세션 58 최종 (2026-03-30 13:00 KST)

## 최신 커밋
- `eb3956e` — 부동산 통계 숫자 불일치 최종 수정
- `c8582b8` — 정확 count 적용 (subTotalCount/unsoldTotalCount/ongoingTotalCount)
- `0626634` — 어드민 대시보드 대폭 업데이트 (3패널+2배지)
- `0e8a4fc` — 분양 상세 정보 대폭 강화 (시세비교/전세가율/전용률/평당가/시공사비교)

## 세션 58 주요 성과

### 부동산 통계 숫자 정확도 수정
- 청약 1,000 → 2,692 (Supabase limit 우회 + 별도 count)
- 실거래 24,797 → 496,987 (RPC DISTINCT apt_name → count(*))
- 분양중·미분양 도넛 차트 정확 count 적용
- RegionStackedBar grandCats에 정확 count 사용

### 분양 상세 정보 대폭 강화 (6가지 추가)
1. 주변 아파트 시세 비교 — 단지백과 34,000개 활용
2. 지역 전세가율 — KPI 3열
3. 전용률 — 전용면적÷공급면적×100
4. 입주까지 남은 기간 — "약 4년 1개월 후"
5. 같은 시공사 분양가 비교
6. 지역 평당가 비교 — +N%/-N%

### 어드민 대시보드 업데이트
- 플랫폼 전체 현황 패널 (8카드)
- 분양 정보 정확도 패널
- SEO / 인덱싱 현황 패널
- HealthBadge: AI요약 + 시세 갱신

### 기타
- ai_summary 1,040건 DB 수정
- 추정/예상 콘텐츠 전면 제거
- complex/[name] trades null 타입 에러 수정
- 주식 시세 장중 갱신 30분→5분

## 아키텍처 규칙 (11개)
1. 블로그 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
9. DB트리거 HOURLY/DAILY_LIMIT 80
10. Supabase RPC: try/catch (.catch() 금지)
11. 작업 완료 시 STATUS.md 반드시 업데이트
