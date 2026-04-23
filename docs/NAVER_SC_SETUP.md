# Naver 서치어드바이저 연동 가이드 (세션 146 A2)

## 현황
- 네이버 서치어드바이저는 GSC 스타일 공식 OpenAPI 를 제공하지 않음.
- 자동 동기화 경로 2가지:
  1. **RSS/사이트맵 ping** (Ping API) — 이미 sitemap.xml 제출 시 작동, 추가 작업 불필요.
  2. **검색 노출 통계** — HTML 대시보드만 제공. 수동 CSV 내려받거나 Puppeteer 로그인 크롤링 필요.

## 수동 등록 체크리스트
1. [ ] https://searchadvisor.naver.com → 사이트 추가 → kadeora.app 소유권 인증 (HTML 파일 업로드 또는 메타태그)
2. [ ] 사이트맵 제출: `https://kadeora.app/sitemap.xml` (세션 146 D1 분리 후 sitemap-index 제출)
3. [ ] robots.txt 검증
4. [ ] RSS 제출: 블로그 개별 피드 URL
5. [ ] 수집 요청 (긴급) — 중요 path 3개 일일 수집 요청 1회
6. [ ] 컬렉션 제출 (선택) — 정보성 리스트 manually
7. [ ] 웹 마스터 도구 연동 토큰 발급 (API 제공 예정 시)

## naver_sc_daily 테이블 수동 적재 (임시)
Naver 대시보드 CSV 다운로드 후:
```sql
\copy naver_sc_daily (date, page_url, impression, click, ctr, avg_rank) FROM 'naver_sc.csv' CSV HEADER;
```

## 향후 자동화
- Puppeteer + 쿠키 기반 로그인 크롤러 (CI only, 자격증명 Vercel env 필요)
- 또는 네이버가 공식 API 를 출시하면 `/api/cron/naver-sc-sync` 에 구현
