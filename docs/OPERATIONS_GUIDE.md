# 카더라 운영 실행 가이드

## 1. Toss 결제 연동 (프리미엄 멤버십)

### 현재 상태
- 결제 API (`/api/payment`) 구현 완료
- `premium_monthly` 상품 DB 활성화 (9,900원)
- 결제 후처리 로직 완료 (30일 활성화 + 닉변권)

### 필요한 설정
1. **Toss 개발자센터**: https://developers.tosspayments.com
2. **테스트 키 발급** → Vercel 환경변수 설정:
   ```
   TOSS_SECRET_KEY=test_sk_xxxxxxxxxxxx
   NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxxxxxxxxxxx
   ```
3. **테스트 결제 진행**: `/payment?product=premium_monthly` 접속 → 테스트 카드로 결제
4. **라이브 전환**: Toss 심사 완료 후 라이브 키로 교체

### 테스트 체크리스트
- [ ] 테스트 키 설정 후 결제 페이지 로드 확인
- [ ] 테스트 결제 → DB `shop_orders` 저장 확인
- [ ] 프로필 `is_premium=true`, `premium_expires_at` 설정 확인
- [ ] 30일 후 `premium-expire` 크론이 해제하는지 확인 (날짜 조작 테스트)

---

## 2. Google Search Console 수동 인덱싱

### 즉시 실행 (5분)
1. https://search.google.com/search-console 접속
2. 속성 확인: `https://kadeora.app` (이미 등록됨, 인증코드 `ozIZYKHPCsd47yk_paPH5mbsSNSCpc-hzLGgQw0lhyU`)
3. **사이트맵 제출** (좌측 메뉴 → 사이트맵):
   ```
   https://kadeora.app/sitemap.xml
   ```
4. **주요 URL 수동 인덱싱 요청** (URL 검사 도구):
   - `https://kadeora.app/` (메인)
   - `https://kadeora.app/stock` (주식)
   - `https://kadeora.app/apt` (부동산)
   - `https://kadeora.app/blog` (블로그)
   - `https://kadeora.app/feed` (피드)
   - `https://kadeora.app/premium` (프리미엄)
   - 인기 블로그 5~10편 URL

### 네이버 서치어드바이저
1. https://searchadvisor.naver.com 접속
2. 사이트 등록 확인 (인증코드 `0d8703ac50ef51c3c2feb0ee48784069936492f5`)
3. **사이트맵 제출**: `https://kadeora.app/sitemap.xml`
4. **웹 페이지 수집 요청**: 주요 URL 5개 수동 제출

### Bing 웹마스터 도구
1. https://www.bing.com/webmasters 접속
2. 인증코드: `BAE0BF3F5071F16E8BAE497D195B2FD6`
3. 사이트맵 제출: `https://kadeora.app/sitemap.xml`

### 인덱싱 모니터링
- IndexNow 대량 전송 크론이 6시간마다 500편씩 전송 중
- `indexed_at` 컬럼으로 진행률 추적:
  ```sql
  SELECT 
    count(*) as total,
    count(indexed_at) as indexed,
    count(*) - count(indexed_at) as pending
  FROM blog_posts WHERE is_published = true;
  ```
- 예상 소요: ~10일이면 18,522편 전체 전송 완료

---

## 3. Anthropic API 크레딧 충전

### 현재 상태
- `ANTHROPIC_API_KEY` 설정됨, 크레딧 부족
- 블로그 AI 리라이팅/생성 크론 77개 중 다수가 API 호출 필요

### 충전 방법
1. https://console.anthropic.com 접속
2. Billing → Add Credits
3. 월 $20~50 추천 (블로그 크론 규모 기준)

### 충전 후 확인
- `/admin` 대시보드 → 크론 패널에서 블로그 생성 건수 확인
- `blog_posts` 테이블에서 최근 생성/리라이팅 글 확인

---

## 4. 운영 체크리스트 (주간)

- [ ] Google Search Console → 색인 상태 확인
- [ ] 네이버 서치어드바이저 → 수집 현황 확인
- [ ] `/admin` 대시보드 → 크론 에러 확인
- [ ] 프리미엄 구독자 수 + 매출 확인 (shop_orders)
- [ ] 블로그 생성/리라이팅 건수 확인
- [ ] 회원 가입 추이 확인
