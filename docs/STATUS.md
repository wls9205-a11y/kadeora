# 카더라 프로젝트 STATUS — 세션 42~43 (2026-03-28 KST)
> 공유 수정 + 시군구 수집 + 어드민 13가지 진화 + 블로그 갭 분석 + 호스팅어 준비
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

## 세션 43 (2026-03-28) — 공유 수정 + 시군구 + 블로그 갭 + 호스팅어

### 공유 버튼 전수조사 + 수정 [COMPLETED]
- **핵심 버그:** ShareButtons URL이 `/feed/{postId}` 고정 → 부동산/주식에서 404
- `window.location.href`로 변경 (6파일), `postId` prop → optional
- 모바일 네이티브 공유 시트(📤) 최우선 + 프로필 공유에도 추가
- CSP form-action에 googletagmanager 추가 (콘솔 에러 해결)
- 카카오 JS Key Vercel 등록 확인 (`30cf0c6a...` kadeora-prod)

### 시군구 수집 강화 [COMPLETED]
- InterestRegistration: 시도→시군구 드롭다운 + 유효성 검사
- interest API: 회원 원클릭 시 profiles residence_district 자동 사용
- ProfileHeader: 프로필 편집에서 시군구 수정 가능

### 어드민 13가지 풀스택 진화 (ebdf37d) [COMPLETED]
1. 숨겨진 3페이지 MissionControl 통합 (infra/notifications/payments)
2. 환경변수 체크 UI (system.tsx)
3. 푸시 알림 관리 (notices.tsx — 발송+이력)
4. 실시간 활동 피드 (dashboard.tsx)
5. 검색어 트렌드 (analytics.tsx 인사이트 탭)
6. 공유 분석 (플랫폼별 비율)
7. 유저 피드백 (FeedbackButton.tsx + /api/feedback)
8. 기능 플래그 토글 (system.tsx + /api/admin/feature-flags)
9. 콘텐츠 인사이트
10. 주식/초대 현황
11. 초대 시스템 (총 초대 수 + 초대왕 Top 5)
12. 상점 관리 (shop.tsx + /api/admin/shop)
13. GOD MODE 42→57크론

**MissionControl 사이드바:** 11→13 섹션 (📢 공지·알림, 🛍️ 상점)

### 블로그 콘텐츠 갭 분석 — 빠진 7가지 발견
| # | 유형 | 데이터 소스 | 편수 |
|---|------|------------|------|
| 1 | 실거래가 트렌드 리포트 | apt_trade_monthly_stats | 17편 |
| 2 | 종목 딥다이브 | stock_quotes+news+flow | 15편 |
| 3 | 재개발 종합 리포트 | redevelopment_zones 전체 | 5편 |
| 4 | 테마주/ETF 분석 | stock_themes | 10편 |
| 5 | 투자 캘린더 | invest_calendar | 4편 |
| 6 | A vs B 비교 | 부동산 8 + 주식 7 | 15편 |
| 7 | 생활 정보 | general 카테고리 보강 | 10편 |
| | **합계** | | **76편** |

스팸 리스크: ✅ 안전 (15,400+ 대비 0.49%, DB 실데이터 기반, safeBlogInsert 유지)

### 호스팅어 전수조사 프롬프트 준비
11단계: 도메인+SSL → robots.txt → sitemap → RSS → mu-plugin(8개) → 파비콘 → Schema → .htaccess → WP 상태 → 사업자정보 제거 → 최종검증

### 호스팅어 도메인/플랜 갱신 완료
- [x] 주린이.site 도메인 — 만료 기간 충분
- [x] 호스팅어 호스팅 플랜 — 갱신 완료

---

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
- [ ] **토스 정산 등록 (D-3!)** — 앱인토스 반려 → 서비스 내용 답변 제출 필요
- [x] ~~주린이.site 도메인 갱신~~ ✅
- [x] ~~호스팅어 플랜 갱신~~ ✅
- [ ] 토스 라이브키 교체
- [ ] KIS_APP_KEY 발급 (한국투자증권)
- [ ] Naver Search Advisor 재제출
- [ ] GA 콘솔에서 stockcoin.net 데이터 스트림/크로스 도메인 제거

### 다음 세션 (클로드 코드 프롬프트 준비됨)
- [ ] **호스팅어 전수조사 + 사업자 정보 제거** → `claude-code-hostinger-full-audit.md`
- [ ] **블로그 76편 대량 생성 (7가지 유형)** → `claude-code-blog-mass-content.md`
- [ ] **stockcoin.net GA 제거** → `claude-code-stockcoin-ga-remove.md`
- [ ] 지역별 현황 디자인 변경 (8개 옵션 미리보기 완료 → 선택 대기)
- [ ] as any 59건 추가 정리 (Supabase 타입 재생성으로 근본 해결)

## DB 변경 완료 (이번 세션)

| 작업 | 내용 |
|------|------|
| apt_sites slug 28건 | 깨진 slug UPDATE 18건 + 비활성화 10건 |
| apt_sites 46건 추가 | 실거래 미연결 단지 배치 INSERT |
| trending_keywords 10개 | 3/27 현시점 갱신 |
| blog data_date | 1,064건 → 2026-03-27 |
| blog updated_at | 13,530건 최신화 |

## 트랜스크립트

`/mnt/transcripts/` 디렉토리에 세션 42~43 관련 파일 존재.
- 세션 43: 공유 수정, 시군구 수집, 어드민 13가지 진화, 블로그 갭 분석, 호스팅어 전수조사 준비
