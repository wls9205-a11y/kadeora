# 카더라 STATUS.md
> 마지막 업데이트: 2026-04-13 05:00 KST (세션 92)

## 세션 92 — 부동산 SEO 대규모 확장 (PHASE 1~6 완료)

### 배포 완료 (11건 커밋, 에러 0건)

#### PHASE 1: 프로그래매틱 SEO 기반 ✅
- `/apt/area/[region]/[sigungu]` 시군구 허브 (~200 페이지)
- `/apt/area/[region]/[sigungu]/[dong]` 동 허브 (~1,500 페이지)
- `robots.txt` 정적 파일 전환
- 단지백과 사이트맵 `image:image` 태그 (34,537개)
- 시군구/동/건설사 전용 사이트맵 id=21
- 내부 링크: apt/[id] + complex/[name] → 허브 pill 링크
- `llms.txt` URL 패턴 + 핵심 데이터 갱신

#### PHASE 2: 비교 + 데이터 ✅
- `/apt/compare/[A-vs-B]` 단지 비교 페이지 (12개 항목 테이블)
- complex/[name] → "비교하기" CTA
- `price_change_1y`: 2,291 → 13,460건 (6배)

#### PHASE 3: 테마 + 크론 ✅
- `/apt/theme/[theme]` 6종 × 18지역 = 108 URL
- `price-change-calc` 크론 (매주 월 06:30)
- 시군구 허브 → 테마 크로스 링크

#### PHASE 4: 건설사 + 크론 수정 ✅
- `/apt/builder/[name]` 건설사 브랜드 페이지 (~200+)
- apt/[id] 시공사 → 건설사 페이지 클릭 링크
- `price-change-calc` 크론 RPC 버그 → JS 계산 전면 재작성
- 건설사 사이트맵 추가

#### PHASE 5: IndexNow + 지역 링크 ✅
- `indexnow-mass` 크론: 시군구 50 + 테마 6 + 건설사 20 + 단지백과 100 URL 추가
- region/[region] → SigunguLinks 컴포넌트 + 테마 6종 링크

#### PHASE 6: 데이터 보강 + 메인 페이지 ✅
- 좌표: 30,982 → **34,527** (+3,545, **100%**)
- price_change_1y: 2,291 → **13,460** (+11,169, **39%**)
- avg_sale_price_pyeong: 26,813 → **27,573** (+760)
- total_households: 55 → **96** (+41)
- `/apt` 메인: 지역 17개 + 테마 6종 + 도구 5종 허브 링크

### 안티스팸 7중 안전장치
1. 시군구 10 / 동 5 / 테마 5 / 건설사 3 / 비교 양쪽 데이터 필수
2. noindex + notFound() 이중 차단
3. 데이터 기반 유니크 분석 문단
4. canonical URL 전량
5. JSON-LD 4종 (BreadcrumbList, FAQPage, Dataset, Article+Speakable)
6. 사이트맵 안티스팸 임계값
7. 공공데이터 출처 명시

### 예상 신규 인덱스 페이지
| 유형 | 수량 |
|------|------|
| 시군구 허브 | ~200 |
| 동 허브 | ~1,500 |
| 테마 | 108 |
| 건설사 | ~200 |
| 비교 | on-demand |
| **합계** | **~2,000+** |

### 다음 세션 (PHASE 7)
- Google Search Console + 네이버 서치어드바이저 사이트맵 재제출
- total_households kapt-sync 크론 처리량 확대
- 리뷰/평점 시스템 → AggregateRating JSON-LD
- 109개 위성 사이트 백링크 전략
- 가격대별 조합 페이지 (시군구 × 가격 티어)
- 월간 자동 시황 리포트 크론
