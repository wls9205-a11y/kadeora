# 카더라 STATUS.md — 세션 66 완료 (2026-04-01 09:30 KST)

## 최신 커밋
- `66d209e` — SSR 이벤트핸들러 에러 수정 + 단지 규모 섹션 신설
- `00a626a` — 총세대수 KPI 표기 보강 + 관심 카드 → 등록 섹션 스크롤
- `55180bf` — 비로그인 가입 유도 팝업 2종 (SignupNudge)
- `6650038` — daily-report-snapshot 504 수정 (120s + 5병렬)

## 세션 66 성과

### Event handler SSR 에러 수정 (CRITICAL)
- `/apt/[id]` 전체에서 "Event handlers cannot be passed to Client Component props" 에러 발생
- `onClick`/`onMouseEnter`/`onMouseLeave` → `KpiCards` 클라이언트 컴포넌트로 분리
- 최신 배포 에러 0건 확인 완료

### 단지 규모 섹션 (ComplexScale) 신설
- `src/components/apt/ComplexScale.tsx` — 총세대수/공급세대수 명확 구분 표시
- 총세대수 없으면 **"정보 준비중"** 표시 (파란색 박스)
- 공급세대수 (초록색 박스) — 이번 분양 공급 세대수
- 둘 다 있고 다르면 → 공급 비율 프로그레스 바 표시
- 하단 그리드: 일반공급/특별공급/동수/최고층/주차 (데이터 있는 것만)

### KPI 카드 개선
- `src/components/apt/KpiCards.tsx` — 클라이언트 컴포넌트로 분리
- ❤️ 관심 카드 클릭 → `InterestRegistration` 섹션으로 smooth scroll
- hover 시 border-color 변경 + "클릭하여 등록" sub 텍스트

### 어드민 업데이트
- 대시보드 API: 총세대수 커버리지 쿼리 추가 (`totalHhR`)
- 건물스펙 그리드: 9항목 (총세대수 추가) 3×3 레이아웃
- 릴리즈 노트: 세션 66 반영

## 데이터 현황
| 항목 | 수치 | 비율 |
|------|------|------|
| PDF 파싱 | 2,485/2,485 | 100% |
| AI 요약 정확 | 2,695 | 100% |
| 종목 섹터 | 1,737/1,737 | 100% |
| 블로그 전체 | 22,659 | 100% |
| 총세대수 | 29/2,695 | 1% |
| 동수 | 2,075/2,695 | 77% |
| 최고층 | 46/2,695 | 2% |
| 주차 | 113/2,695 | 4% |

## PENDING
- [ ] Anthropic 크레딧 충전 (최우선)
- [ ] 토스페이먼츠 API 키
- [ ] KIS_APP_KEY 발급
- [ ] 통신판매업 신고
- [ ] Google/Naver 수동 URL 제출
- [ ] Search Console 오류 사이트맵 삭제

## 아키텍처 규칙 (12개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts 5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile 보호 8. daily_create_limit 80 9. DB트리거 LIMIT 80 10. Supabase RPC try/catch 11. STATUS.md 필수 12. 디자인 토큰 우선
