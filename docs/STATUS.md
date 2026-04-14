## 세션 106~107 — 부동산 탭 전체 이미지 근본 해결 완료

### 핵심 문제 진단 및 해결
- apt_sites(5,775건)만 이미지 수집 → 실거래 탭 이미지 6.9% 커버에 불과
- apt_complex_profiles(34,539건)가 실거래 단지 100% 커버하는데 이미지 컬럼 없었음
- aptImageMap이 apt_sites.name만 인덱싱 → 실거래/단지백과 대부분 OG fallback

### 근본 해결 완료
1. apt_complex_profiles.images 컬럼 추가 (DB 마이그레이션)
2. page.tsx aptImageMap: apt_sites + apt_complex_profiles 병렬 조회로 확장
3. ComplexClient.tsx: 단지백과 카드에 실제 이미지 표시
4. complex/page.tsx: images 컬럼 select + imageUrl 전달
5. collect-complex-images 크론 신규 (매시간 :30분, BATCH 500, PARALLEL 20)
6. 검색 쿼리 개선: '{sigungu} {cleanName} 아파트'로 이미지 수집률 향상
7. cleanName(): 괄호 안 코드/숫자 제거, 동 번호 제거

### 이미지 수집 현황
- apt_sites: 4,801 / 5,029 (95.5%) — 228건은 공공임대 등 진짜 없음
- apt_complex_profiles: 1,717 / 34,539 (5%) — Naver API 일일 한도로 중단
  → collect-complex-images 크론이 매시간 500건씩 자동 처리 (약 2.8일 완료 예정)

### 탭별 커버리지
| 탭 | 데이터 소스 | 이전 | 현재 |
|---|---|---|---|
| 청약 | apt_subscriptions(2,713) | ~56% | ~90%+ |
| 분양중 | sub+unsold 조합 | ~56% | ~90%+ |
| 미분양 | unsold_apts(204) | ~89% | ~95% |
| 재개발 | redevelopment_projects(218) | ~91% | ~95% |
| 실거래 | apt_transactions(20,997단지) | 6.9% | 진행 중 (~10% → 100%) |
| 단지백과 | apt_complex_profiles(34,539) | OG only | 실제 이미지 (진행 중) |

### 프로덕션 상태
- 배포: 최신 READY
- 런타임 에러: 0건
- collect-complex-images 크론: 매시간 :30분 자동 실행 중
- collect-site-images 크론: 매시간 :00분 자동 실행 중
