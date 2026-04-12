# 블로그 시스템 현황 (2026-04-12)

## 크론 현황 (블로그 관련 30개)

### 코어 크론 (신규/교체)
| 크론 | 주기 | 상태 | 역할 |
|------|------|------|------|
| blog-enrich-rewrite | 매 3시간 | ✅ 라이브 | C등급 글 실데이터 기반 재생성 (blog-rewrite 대체) |
| blog-upcoming-projects | 화·금 09시 | ✅ 라이브 | 카더라 선점 콘텐츠 자동 발행 |
| blog-data-update | 일 06시 | ✅ 라이브 | 상위 300글 시세 데이터 갱신 |
| blog-publish-queue | 3회/일 | ✅ 라이브 | 발행 시 품질 점수 자동 기록 |

### 품질 시스템
| 시스템 | 파일 | 상태 |
|--------|------|------|
| 실데이터 주입 | blog-data-enrichment.ts | ✅ 라이브 |
| 품질 게이트 | blog-quality-gate.ts | ✅ 라이브 |
| 프롬프트 템플릿 | blog-prompt-templates.ts | ✅ 라이브 |
| 인포그래픽 | /api/og-infographic | ✅ 기존 구현 |

### DB
| 테이블 | 건수 | 용도 |
|--------|------|------|
| upcoming_projects | 8 | 카더라 선점 대상 현장 |
| blog_posts.seo_score | - | 품질 점수 (0~100) |
| blog_posts.seo_tier | - | 등급 (S/A/B/C/F) |

### UI 컴포넌트
| 컴포넌트 | 상태 | 역할 |
|----------|------|------|
| BlogSidebar | ✅ 라이브 | 데스크탑 2컬럼 sticky 사이드바 |
| BlogMetricCards | ✅ 라이브 | 핵심 지표 카드 |
| blog-detail-layout CSS | ✅ 라이브 | 1024px+ 2컬럼 레이아웃 |

### 어드민
| 기능 | 상태 |
|------|------|
| DataTab 품질 게이트 | ✅ 라이브 |
| admin/v2 blogQuality | ✅ 라이브 |
