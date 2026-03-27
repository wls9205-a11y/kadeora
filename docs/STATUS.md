# 카더라 프로젝트 STATUS — 세션 42 (2026-03-27 KST)
> 풀스택 전수 조사 + 주식/부동산 강화 + 보안/SEO/코드품질 개선 + 어드민 대시보드 진화
> **다음 세션 시작:** "docs/STATUS.md 읽고 작업 이어가자"

## 프로덕션 현황 (실시간)

| 지표 | 수치 |
|------|------|
| **유저** | 119명 |
| **게시글/댓글** | 4,071 / 1,912 |
| **블로그** | 15,453편 |
| **주식 종목** | 247개 |
| **청약** | 2,685건 |
| **apt_sites (active)** | 5,505 |
| **실거래** | 5,408건 |
| **미분양** | 203건 |
| **재개발** | 202건 |
| **토론** | 30개 |
| **크론 24h** | 278/278 (100%) |
| **24h 생산량** | 28,716건 |
| **24h PV** | 231 |
| **DB 크기** | 226 MB |
| **프로덕션 에러** | 0건 |

## 코드베이스

| 지표 | 수치 |
|------|------|
| 파일 수 | 484개 |
| 총 줄 수 | 51,089줄 |
| API 라우트 | 149개 |
| 크론 | 57개 |
| DB 테이블 | 90+ |
| `as any` | 59건 (98→59, -39) |
| `ignoreBuildErrors` | **false** (tsc 빌드 에러→배포 차단) |
| `tsc --noEmit` | 0건 에러 |

## 세션 42 커밋 (15건+)

### 코드 품질 / 인프라
| SHA | 내용 |
|-----|------|
| `bdd55ed` | **ignoreBuildErrors: true → false** + 섹터 SEO 14페이지 |
| `a2f2623` | globals.css 1,296줄 → 4파일 분할 + StockRow useCallback |
| `1f0f8bb` | as any 98→74건 + globals.d.ts 브라우저 타입 선언 |
| `8c6796e` | FeedClient as any 6건 제거 (select 필드 추가) |
| `8d2dffe` | as any 추가 정리 (TransactionTab, StockClient, ChatRoom) |

### SEO / 사이트맵
| SHA | 내용 |
|-----|------|
| `49936f2` | llms.txt + robots.txt + KAKAO 키 하드코딩 제거 |
| `bf6a07a` | 사이트맵 인덱스 분할 (6+세그먼트, 50k URL 대비) |
| `bdd55ed` | `/stock/sector/[name]` 섹터별 SEO 페이지 14개 신규 |

### 크론 수정
| SHA | 내용 |
|-----|------|
| `1ac0b27` | stock-flow/news/calendar → haiku 모델 + 에러 상세 로깅 |

### 주식 / 부동산 UX
| SHA | 내용 |
|-----|------|
| `47595e3` | apt/[slug] 퍼지매칭 5단계 + 모바일 오버플로우 |
| `aaed517` | 부동산 통합 검색창 + apt_sites 46건 |
| `a40d76c` | 주식 섹터 필터 선택색 통일 + 검색 건수 표시 |
| `4439005` | 전 탭 빈 결과 안내 UX 통일 |
| `49936f2` | 진단 페이지 75→174줄 (전략/커트라인/팁) |
| `4ddad74` | seed-posts 50개 템플릿 + 중복방지 |

### 어드민
| SHA | 내용 |
|-----|------|
| `ebdf37d` | 어드민 13가지 풀스택 진화 (공지/피드백/GOD 57크론) |
| `2e842bc` | **대시보드 대폭 강화** (LIVE 새로고침/헬스바/크론상세/인기페이지/카테고리분포/Quick Actions) |
| `8ff847a` | Quick Actions 연결 (data-section) + 콘텐츠 KPI 4카드 |

## 핵심 파일 경로

### 주식 / 부동산
- `src/app/(main)/stock/StockClient.tsx` — 주식 메인 (useCallback StockRow)
- `src/app/(main)/stock/sector/[name]/page.tsx` — 섹터 SEO 페이지 (신규)
- `src/app/(main)/apt/AptClient.tsx` — 부동산 메인 (통합 검색창)
- `src/app/(main)/apt/tabs/*.tsx` — 5개 탭 (effectiveSearch 패턴)
- `src/app/(main)/apt/[id]/page.tsx` — apt 상세 (퍼지매칭 5단계)
- `src/app/(main)/apt/diagnose/page.tsx` — 청약 진단 (174줄)
- `src/components/RegionStackedBar.tsx` — 지역별 현황 바 차트

### 어드민
- `src/app/admin/sections/dashboard.tsx` — 대시보드 (358줄, 7기능)
- `src/app/admin/MissionControl.tsx` — 13섹션 라우터 (data-section)
- `src/app/api/admin/dashboard/route.ts` — 대시보드 API (509줄)

### 인프라
- `next.config.ts` — ignoreBuildErrors: false
- `src/app/sitemap.ts` — generateSitemaps 인덱스 분할
- `src/app/globals.css` (368줄) + `src/app/styles/` (3파일, 928줄)
- `src/types/globals.d.ts` — 브라우저 전역 타입 선언

## 🟡 PENDING 작업

### 수동 (직접 해야 함)
- [ ] **토스 정산 등록 (D-4!)** — 앱인토스 반려 → 서비스 내용 답변 제출 필요
- [ ] 토스 라이브키 교체
- [ ] KIS_APP_KEY 발급 (한국투자증권)
- [ ] 주린이.site 도메인 갱신
- [ ] Naver Search Advisor 재제출

### 다음 세션 (코드)
- [ ] 지역별 현황 디자인 변경 (8개 옵션 미리보기 완료 → 선택 대기)
- [ ] 검색창 2개 → 1개 통합 (글로벌 검색만 유지)
- [ ] 공유 문구 수정 (주식/부동산) — 로컬 변경 완료, 커밋 대기
- [ ] as any 59건 추가 정리 (Supabase 타입 재생성으로 근본 해결)
- [ ] 미사용 인덱스 30개 삭제 (pg_stat 리셋 여부 확인 후)

## DB 변경 완료 (이번 세션)

| 작업 | 내용 |
|------|------|
| apt_sites slug 28건 | 깨진 slug UPDATE 18건 + 비활성화 10건 |
| apt_sites 46건 추가 | 실거래 미연결 단지 배치 INSERT |
| trending_keywords 10개 | 3/27 현시점 갱신 |
| blog data_date | 1,064건 → 2026-03-27 |
| blog updated_at | 13,530건 최신화 |

## 트랜스크립트

`/mnt/transcripts/` 디렉토리에 세션 42 관련 6개 파일 존재.
