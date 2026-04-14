## 세션 106 — 부동산 탭 전체 이미지 근본 해결

### 커밋: 진행 중
### 변경: 주요 7파일

### 핵심 문제 진단
- apt_sites(5,775건)만 이미지 수집 → 실거래 탭 20,997개 단지 중 93%가 OG 이미지 fallback
- apt_complex_profiles(34,539건)가 실거래 단지 100% 커버하는데 이미지 컬럼 없었음
- aptImageMap이 apt_sites.name만 인덱싱 → 실거래/단지백과 대부분 미매핑

### 근본 해결
1. apt_complex_profiles.images 컬럼 추가 (DB 마이그레이션 완료)
2. page.tsx aptImageMap: apt_sites + apt_complex_profiles 병렬 조회로 확장
3. collect-complex-images 크론 신규 (매시간 :30분, BATCH 400, PARALLEL 8)
4. /apt/complex/page.tsx: images 컬럼 select + ComplexClient에 imageUrl 전달
5. ComplexClient.tsx: OG fallback → apt_complex_profiles 실제 이미지
6. temp-bulk-img/complex: 즉시 대량 수집 엔드포인트 (60건/8초)

### 탭별 이미지 커버리지
| 탭 | 데이터 소스 | 적용 전 | 적용 후(목표) |
|---|---|---|---|
| 청약 | apt_subscriptions(2,713) | ~56% | ~85%+ |
| 분양중 | sub+unsold 조합 | ~56% | ~85%+ |
| 미분양 | unsold_apts(204) | ~89% | ~95%+ |
| 재개발 | redevelopment_projects(218) | ~91% | ~95%+ |
| 실거래 | apt_transactions(20,997단지) | 6.9% → | ~100% |
| 단지백과 | apt_complex_profiles(34,539) | OG only | 실제 이미지 |

### 이미지 수집 현황 (세션 중 진행)
- apt_sites: ~2,906 → ~2,000 (진행 중)
- apt_complex_profiles: 0 → 수집 중 (매시간 크론 + temp 엔드포인트)

### 프로덕션 상태
- Vercel: 배포 완료
- 런타임 에러: 0건

---

## 세션 105 — Node이 진행한 작업들
