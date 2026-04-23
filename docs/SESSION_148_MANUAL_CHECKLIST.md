# Session 148 — Node 수동 작업 체크리스트

## 1. Kakao 개발자 콘솔
- [ ] https://developers.kakao.com/console/app 접속
- [ ] 앱 "카더라" 선택
- [ ] **제품 설정 → 지도·로컬 API** (OPEN_MAP_AND_LOCAL) **활성화**
- [ ] "카카오맵" 약관 동의
- [ ] 완료 후 5분 대기 → `node scripts/diag-kakao-api.mjs` 로 HTTP 200 확인
- [ ] 성공 시 `node scripts/geocode-missing-v2.mjs` 재실행으로 잔여 4건 복구

## 2. 네이버 스마트플레이스 등록
- [ ] https://smartplace.naver.com 접속
- [ ] 사업자번호: **278-57-00801**
- [ ] 주소: 부산 연제구 연동로 27, 405호
- [ ] 카테고리: 정보통신 / 정보제공 / 부동산·금융정보 플랫폼
- [ ] 홈페이지: https://kadeora.app
- [ ] 대표 이미지 3~5장 업로드 (`/public/og-image*.png` 활용)
- [ ] 소유권 인증 서류 업로드
- [ ] 완료 후 2~6주 네이버 Knowledge Graph 반영

## 3. 네이버 블로그 개설 + OAuth
- [ ] https://blog.naver.com 에서 ID `kadeora` 또는 `kadeora_app` 확보
- [ ] 블로그 프로필에 사업자번호 + 홈페이지 링크 등록
- [ ] https://developers.naver.com/apps 앱 생성 — "블로그 글쓰기" 권한
- [ ] OAuth 2.0 인증 플로우로 access_token + refresh_token 발급
- [ ] .env.local 및 Vercel env 에 등록:
  ```
  NAVER_BLOG_OAUTH_TOKEN=ya29.xxx
  NAVER_BLOG_ID=kadeora
  ```
- [ ] `node scripts/naver-blog-sync.mjs --limit=3` 로 3편 테스트 포스팅

## 4. 네이버 서치어드바이저 사이트맵 재제출
- [ ] https://searchadvisor.naver.com 접속
- [ ] kadeora.app 사이트 선택
- [ ] **사이트맵 제출** 메뉴 → 아래 20개 경로 입력
  - https://kadeora.app/sitemap.xml  (인덱스)
  - https://kadeora.app/image-sitemap.xml
  - https://kadeora.app/news-sitemap.xml
  - https://kadeora.app/sitemap/0.xml ~ /sitemap/12.xml (13개)
  - https://kadeora.app/sitemap/13.xml ~ /sitemap/21.xml (9개)
- [ ] **수집 요청(긴급)** → 중요 path 3개 일일 요청
  - https://kadeora.app
  - https://kadeora.app/blog
  - https://kadeora.app/apt

## 5. GSC OAuth refresh_token 확인
- [ ] https://console.cloud.google.com/apis/credentials 에서 OAuth 2.0 Client ID 확인
- [ ] refresh_token 만료 여부 → `oauth_tokens` 테이블 service='gsc' row 존재 확인:
  ```sql
  SELECT service, CASE WHEN refresh_token IS NOT NULL THEN 'SET' ELSE 'NULL' END FROM oauth_tokens WHERE service='gsc';
  ```
- [ ] 없으면 OAuth consent flow 재수행 → refresh_token 저장
- [ ] 내일 04:00 KST 에 pg_cron gsc-sync-daily 자동 실행 → gsc_search_analytics 적재 확인

## 6. GitHub 노출 토큰 revoke (세션 141 잔여)
- [ ] https://github.com/settings/tokens 접속
- [ ] (세션 141에 노출된 구 PAT — 로컬 git config 및 관련 기록 참조) 가 여전히 존재하면 **Revoke**
- [ ] 새 PAT 발급 (repo scope only, expiration 90d)
- [ ] `git remote set-url origin https://wls9205-a11y:<NEW_PAT>@github.com/wls9205-a11y/kadeora.git` 또는 credential manager 재설정

## 7. CWV baseline 모니터링 (7일 누적 후)
- [ ] Session 147 배포 이후 web_vitals 적재 시작
- [ ] 7일 후 Admin `/admin/seo/crawl` 또는 Supabase 에서 p75 산출
- [ ] LCP p75 > 2.5s 이면 Image optimize / 폰트 preload / critical CSS inline 착수
