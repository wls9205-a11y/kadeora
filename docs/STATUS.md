# 카더라 STATUS.md — 세션 71 전수감사 (2026-04-04 KST)

## 세션 71 전수 교차검증 감사 + 수정

### 정보 정확성 수정 (25건 즉시 수정)
1. **등급명 4중 불일치 → 통일** — FAQ/가이드/등급페이지 JSON-LD 전부 `constants.ts GRADE_MAP` 기준으로 통일 (새싹→정보통→동네어른→소문난집→인플루언서→빅마우스→찐고수→전설→신의경지→카더라신)
2. **포인트 수치 5중 불일치 → SSOT** — `point-rules.ts` 생성. 가이드(+10P/+5P), 등급페이지(+10/+5/+10), 상점(+10P) 전부 실제 API 값과 일치시킴. 미구현 항목(좋아요/팔로워/메가폰) 제거
3. **종목 수 "1,700+" → 삭제** — 가이드, 주식 메타, RSS피드, SignupCTA, TossTeaser, TossBottomBanner, GuestNudge, SignupNudge 등 10곳+ 수정. 실제 ~730종목 기반 표현으로 변경
4. **블로그 수 6중 불일치 → 통일** — manifest(15,500→삭제), 메인/가이드/CTA(22,600→삭제), TossTeaser(22,000→삭제), BlogTossGate(22,000→삭제). 하드코딩 제거
5. **청약 가점 계산기 공식 오류 → 수정** — `(years+1)*2`, `(family+1)*5`로 변경. 0명=5점, 15년=32점 정확히 반영
6. **계정 탈퇴 버그 → 수정** — UI→API body 전송 추가, 확인 문구 "탈퇴하겠습니다"로 통일, 안내문 "익명 처리"로 정정
7. **세법 콘텐츠 3건 수정** — 이월과세 5년→10년(2023.1.1~), 양도세 과세표준 1,200만→1,400만/4,600만→5,000만(2023~), 주식 이월과세 1년 경고 추가
8. **군위군 행정구역 수정** — `regions.ts` 경북→대구 이동 (2023.7.1 편입 반영)
9. **환불정책 상품명 → 상점과 일치** — "전광판 확성기"→"확성기 라이트/스탠다드/프리미엄/무제한"
10. **데이터 출처 4중 불일치 → 통일** — 이용약관(Yahoo Finance→금융위원회), Disclaimer(해외시세 추가), 블로그 면책문(한국거래소→금융위원회), `data-sources.ts` SSOT 생성

### 코드 품질 수정
11. **MiniChart 색상 시장 분기** — `isKR` prop 추가, 해외주식 green/red 적용
12. **ChartTab 색상 시장 분기** — 기간변동/최고가/최저가 currency 기반 색상
13. **미국주식 시총 분류 통화 분기** — USD: $1T+초대형/$100B+대형/$10B+중형
14. **결제 실패 링크** — `/shop/megaphone` → `/shop`
15. **온보딩 코인 관심사** → 재개발/재건축으로 변경
16. **주식 갱신주기 FAQ** — 15분→5~10분
17. **청약탭 갱신 시간** — "06시"→"자동 갱신"
18. **개인정보처리방침** — AES-256→AES-256-GCM, 통신비밀보호법 표기 구체화
19. **메인페이지 fallback stats** — stocks 1733→730
20. **가이드 PER 비교 안내 삭제** — 미구현 기능
21. **가이드 블로그 저자** — "데이터팀"→"자동 생성"
22. **가이드 글씨 크기 기본값** — "크게"→"보통"
23. **가이드 테마** — "전환 가능"→"다크 기본, 라이트 전환 가능"
24. **가이드 초대 포인트** — "+50P 둘 다"→코드 공유 안내로 변경
25. **manifest.json** — 하드코딩 수치 제거

### 신규 파일
- `src/lib/point-rules.ts` — 포인트 SSOT (9개 규칙 + 출석 보너스)
- `src/lib/data-sources.ts` — 데이터 출처 SSOT (8개 소스 + 공개용 텍스트)

### 전수감사 발견 총합
- 🚨 심각 14건 / ⚠️ 중요 19건 / 📋 경미 13건 = **총 46건 정보 오류**
- 코드 품질 10건 / 보안 5건 / 접근성 6건 / 성능 6건 / SEO 5건 = **추가 32건**
- **이번 세션에서 25건 즉시 수정 완료**

### 잔여 과제 (Phase 3~4)
- 빈 catch 142개 → 로깅 추가
- 크론 fetch 47개 timeout 추가
- 중복 크론 제거 (stock-price, stock-refresh)
- WebP 이미지 변환
- a11y: aria-label + img alt 59+11개
- TypeScript `any` 731개 점진 제거
- 세법 버전관리 시스템 구축

---


## 세션 71 전수 교차검증 감사 + 수정

### 정보 정확성 수정 (25건 즉시 수정)
1. **등급명 4중 불일치 → 통일** — FAQ/가이드/등급페이지 JSON-LD 전부 `constants.ts GRADE_MAP` 기준으로 통일 (새싹→정보통→동네어른→소문난집→인플루언서→빅마우스→찐고수→전설→신의경지→카더라신)
2. **포인트 수치 5중 불일치 → SSOT** — `point-rules.ts` 생성. 가이드(+10P/+5P), 등급페이지(+10/+5/+10), 상점(+10P) 전부 실제 API 값과 일치시킴. 미구현 항목(좋아요/팔로워/메가폰) 제거
3. **종목 수 "1,700+" → 삭제** — 가이드, 주식 메타, RSS피드, SignupCTA, TossTeaser, TossBottomBanner, GuestNudge, SignupNudge 등 10곳+ 수정. 실제 ~730종목 기반 표현으로 변경
4. **블로그 수 6중 불일치 → 통일** — manifest(15,500→삭제), 메인/가이드/CTA(22,600→삭제), TossTeaser(22,000→삭제), BlogTossGate(22,000→삭제). 하드코딩 제거
5. **청약 가점 계산기 공식 오류 → 수정** — `(years+1)*2`, `(family+1)*5`로 변경. 0명=5점, 15년=32점 정확히 반영
6. **계정 탈퇴 버그 → 수정** — UI→API body 전송 추가, 확인 문구 "탈퇴하겠습니다"로 통일, 안내문 "익명 처리"로 정정
7. **세법 콘텐츠 3건 수정** — 이월과세 5년→10년(2023.1.1~), 양도세 과세표준 1,200만→1,400만/4,600만→5,000만(2023~), 주식 이월과세 1년 경고 추가
8. **군위군 행정구역 수정** — `regions.ts` 경북→대구 이동 (2023.7.1 편입 반영)
9. **환불정책 상품명 → 상점과 일치** — "전광판 확성기"→"확성기 라이트/스탠다드/프리미엄/무제한"
10. **데이터 출처 4중 불일치 → 통일** — 이용약관(Yahoo Finance→금융위원회), Disclaimer(해외시세 추가), 블로그 면책문(한국거래소→금융위원회), `data-sources.ts` SSOT 생성

### 코드 품질 수정
11. **MiniChart 색상 시장 분기** — `isKR` prop 추가, 해외주식 green/red 적용
12. **ChartTab 색상 시장 분기** — 기간변동/최고가/최저가 currency 기반 색상
13. **미국주식 시총 분류 통화 분기** — USD: $1T+초대형/$100B+대형/$10B+중형
14. **결제 실패 링크** — `/shop/megaphone` → `/shop`
15. **온보딩 코인 관심사** → 재개발/재건축으로 변경
16. **주식 갱신주기 FAQ** — 15분→5~10분
17. **청약탭 갱신 시간** — "06시"→"자동 갱신"
18. **개인정보처리방침** — AES-256→AES-256-GCM, 통신비밀보호법 표기 구체화
19. **메인페이지 fallback stats** — stocks 1733→730
20. **가이드 PER 비교 안내 삭제** — 미구현 기능
21. **가이드 블로그 저자** — "데이터팀"→"자동 생성"
22. **가이드 글씨 크기 기본값** — "크게"→"보통"
23. **가이드 테마** — "전환 가능"→"다크 기본, 라이트 전환 가능"
24. **가이드 초대 포인트** — "+50P 둘 다"→코드 공유 안내로 변경
25. **manifest.json** — 하드코딩 수치 제거

### 신규 파일
- `src/lib/point-rules.ts` — 포인트 SSOT (9개 규칙 + 출석 보너스)
- `src/lib/data-sources.ts` — 데이터 출처 SSOT (8개 소스 + 공개용 텍스트)

### 전수감사 발견 총합
- 🚨 심각 14건 / ⚠️ 중요 19건 / 📋 경미 13건 = **총 46건 정보 오류**
- 코드 품질 10건 / 보안 5건 / 접근성 6건 / 성능 6건 / SEO 5건 = **추가 32건**
- **이번 세션에서 25건 즉시 수정 완료**

### 잔여 과제 (Phase 3~4)
- 빈 catch 142개 → 로깅 추가
- 크론 fetch 47개 timeout 추가
- 중복 크론 제거 (stock-price, stock-refresh)
- WebP 이미지 변환
- a11y: aria-label + img alt 59+11개
- TypeScript `any` 731개 점진 제거
- 세법 버전관리 시스템 구축

---


## 세션 70 전체 작업 완료

### 커밋 이력
- `4aa2811d` — 정보력 대폭 강화 8대 개선 (RPC 7 + API 6 + 컴포넌트 5)
- `4d4e6dc6` — apt-price-change 크론 추가
- `9bf000b1` — 단지백과 주변비교 + 종목 이동평균선 (RPC 4 + API 4 + 컴포넌트 2)
- `6b98a4f4` — STATUS.md 최종
- (현재) — SEO 전수 감사 통계자료실 보강 + 어드민 릴리즈노트 갱신

### DB RPC 신규 (10개)
get_apt_rankings · search_rent_transactions · get_rent_stats · get_stock_52w_range · get_unsold_trend · get_exchange_rate_trend · get_apt_price_trend · get_apt_jeonse_trend · get_nearby_apt_compare · get_stock_ma

### Public API 엔드포인트 (10개)
apt-rankings · rent-search · unsold-trend · exchange-trend · stock-52w · landmark-apts · apt-price-trend · apt-jeonse-trend · apt-nearby · stock-ma

### 신규 컴포넌트 (7개)
AptRankingCard · LandmarkAptCards · UnsoldTrendMini · ExchangeRateMiniChart · Stock52WeekBar · AptNearbyCompare · StockMAOverlay

### 데이터 계산
- price_change_1y: 2,291단지 (상승1,247 / 하락1,029) + 매일 자동 재계산 크론

### SEO 전수 감사 결과
- 전 페이지 metadata/JSON-LD/OG/canonical/naver 확인 ✅
- robots.txt: Google/Naver/Bing/Daum/Zum/AI 크롤러 ✅
- sitemap.xml: 16개 서브맵 + 이미지 사이트맵 ✅
- geo 태그: geo.region/position/ICBM ✅
- hreflang: ko-KR ✅
- 사이트 인증: Google/Naver/Bing ✅
- 통계자료실(/apt/data, /stock/data): naver 태그 + FAQ + Breadcrumb 보강 완료
- IndexNow: 42개 참조 ✅

### 블로그
- 22,663편 / 가독성 6가지 수정 / blog-rewrite 프롬프트 강화

### 인프라 현황
- 크론: **97개** / Public API: **10개** / TS 에러: **0** / 빌드: **READY**
