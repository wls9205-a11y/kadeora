## 세션 107 — 카드 정보밀도 극대화 + 히어로 이미지 그라데이션

### 커밋: e36f5344
### 변경: 3파일, +43 -14

### 변경 내용

#### 1. 히어로 이미지 그라데이션 오버레이 (globals.css)
- `hero-img::after` 전체 그라데이션 추가 (상단 30% + 하단 75% 어둡게)
- 실사진 크롤링 이미지 위에서 배지/텍스트 가독성 확보
- badges, chip에 z-index:2 적용하여 오버레이 위에 표시

#### 2. 실거래 탭 KPI 4열→8열 확장 (TransactionTab.tsx)
- 기존: 평당가, 거래수, 최저가, 최고가
- 추가: **전고점대비%**, **평형 평균가**, **직전거래 금액**, **직전대비 등락**
- 직전거래 = sameApt[1], 등락 = 현재-직전 금액/비율

#### 3. 단지백과 카드 3열→6열 확장 (ComplexClient.tsx)
- 기존: 전세, 월세, 평당가
- 추가: **갭투자 금액**(매매-전세), **매매 거래수**, **전월세 거래수**
- KPI 그리드 스타일로 통일 (border + bg-surface)

### 변경 불필요 확인 (이미 정보밀도 높은 탭)
- 청약: 8열 KPI + 타입별 분양가 테이블 + 납부비율 바 + 일정 + 커뮤니티
- 분양중: 8열 KPI + 파이프라인 + 상담사 + EngageRow
- 미분양: 8열 KPI + 미분양률 바 + AI 요약 + 한줄평
- 재개발: 진행률 바 + 세대수/면적/용적률/건폐율 + 역세권/학군 + AI 요약

---

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
