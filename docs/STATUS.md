## 세션 108 — SEO 전체 감사 28개 항목 발견 및 수정

### 커밋: 5ef2086a (push 대기)
### 변경: 7파일, +47 -7

### 코드 변경 (배포 대기)

| 파일 | 변경 |
|---|---|
| `src/lib/sanitize-html.ts` | 외부링크 nofollow noopener 자동 추가 |
| `src/components/LandmarkAptCards.tsx` | alt="" → `${a.name} 현장 사진` |
| `src/app/sitemap/[id]/route.ts` | 시드유저 피드글 sitemap 제외 |
| `src/app/(main)/feed/[id]/page.tsx` | 시드유저 글 noindex (is_seed 체크) |
| `src/app/(main)/layout.tsx` | 푸터에 내부링크 16개 추가 (고아 페이지 해소) |
| `src/app/(main)/calc/page.tsx` | WebApplication schema 추가 |
| `src/app/(main)/discuss/page.tsx` | WebPage schema (토론 about 정보) 추가 |

### DB 일괄 작업 (완료)

| 항목 | 결과 |
|---|---|
| 블로그 제목 60자 초과 131건 | ✅ 57자+... 트림 |
| apt seo_title/desc 262건 | ✅ 데이터 기반 자동생성 → 누락 0건 |
| 주식 섹터 697건 | ✅ 키워드 기반 분류 (664건 '기타' 남음) |
| 재개발 summary 140건 | ✅ 데이터 기반 자동생성 |
| 주식 desc 50자미만 64건 | ✅ 데이터 기반 보강 |
| 블로그 내부링크 5,055건 | ✅ 카테고리별 관련 콘텐츠 링크 섹션 추가 → 누락 0건 |

### PENDING (추가 작업 필요)
- 역세권/학군 크론 (`apt-enrich-location`) — 이미 존재, `KAKAO_REST_API_KEY` Vercel 환경변수 설정 필요
- 주식 섹터 '기타' 664건 — KRX/DART API 연동 필요
- 블로그 FAQ 484건 / 테이블 914건 — 리라이트 크론으로 처리 필요
- 블로그 카테고리/태그 랜딩 페이지 — 신규 라우트 개발 필요
- 페이지네이션 rel=prev/next — 코드 추가 필요
- next/image 마이그레이션 (부동산 5탭) — 큰 작업

---

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
