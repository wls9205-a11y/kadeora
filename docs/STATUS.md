# 카더라 STATUS.md
> 마지막 업데이트: 2026-04-13 06:00 KST (세션 92)

## 세션 92 — 부동산 SEO 대규모 확장 완료 (PHASE 1~8)

### 총 배포: 15건 커밋, 에러 0건

#### 신규 페이지 시스템 (5종)
| 유형 | URL | 페이지 수 | 안티스팸 |
|------|-----|----------|---------|
| 시군구 허브 | /apt/area/{시도}/{시군구} | ~200 | 10개 미만 noindex |
| 동 허브 | /apt/area/{시도}/{시군구}/{동} | ~1,500 | 5개 미만 noindex |
| 테마 6종 | /apt/theme/{theme}?region= | 108 | 5개 미만 notFound |
| 건설사 | /apt/builder/{이름} | ~200 | 3현장 미만 noindex |
| 단지 비교 | /apt/compare/{A}-vs-{B} | ~200+on-demand | 양쪽 데이터 필수 |
| **합계** | | **~2,200+** | |

#### 인프라 개선
- robots.txt 정적 전환
- 단지백과 사이트맵 image:image 태그 (34,537개)
- 사이트맵 id=21 (시군구+동+건설사+비교 ~200)
- 테마 108 URL 사이트맵 추가
- IndexNow 대량 확장 (+176 URL/배치)
- llms.txt URL 패턴 + 핵심 데이터 수치

#### 내부 링크 메시 (8개 페이지 강화)
- /apt (메인) → 17지역 + 6테마 + 5도구
- /apt/region/[region] → 시군구 허브 + 6테마
- /apt/area/[region]/[sigungu] → 동 + 6테마 + TOP10
- /apt/complex/[name] → 시군구/동 허브 + 비교 CTA
- /apt/[id] → 시군구/동 허브 + 건설사 링크
- /blog/[slug] → 단지백과 + 시군구 허브 (apt 카테고리)

#### 크론 3개 신규
| 크론 | 스케줄 | 기능 |
|------|--------|------|
| price-change-calc | 매주 월 06:30 | 가격 변동률 자동 계산 |
| monthly-market-report | 매월 2일 07:00 | 20개 시군구 시황 블로그 |
| blog-complex-crosslink | 매주 수 05:00 | blog_post_count 업데이트 |

#### JSON-LD 구조화 데이터
- 조건부 AggregateRating (review_count > 0 시만)
- BreadcrumbList, FAQPage, Dataset, Article+Speakable 전량

#### DB 보강 최종
| 데이터 | 시작 | 현재 | 변화 |
|--------|------|------|------|
| 좌표 | 30,982 (89.7%) | **34,527 (100%)** | +3,545 |
| price_change_1y | 2,291 (6.6%) | **13,460 (39%)** | +11,169 |
| 평당가 | 26,813 | **27,573** | +760 |
| total_households | 55 | 96 | +41 |
| blog_post_count | - | 2,003 | (확인) |

### Node 수동 작업 필요
1. Google Search Console → sitemap.xml 재제출
2. 네이버 서치어드바이저 → sitemap.xml + feed.xml 재제출
3. Google Publisher Center → 뉴스 파트너 신청
4. Bing 웹마스터 → 사이트맵 확인
5. 109개 위성 사이트 → kadeora.app 백링크 추가
