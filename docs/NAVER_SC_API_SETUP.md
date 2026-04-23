# 네이버 서치어드바이저 API 색인 제출 (세션 149 C)

## 현황
네이버는 **공식 색인 제출 Open API 를 제공하지 않음** (세션 146 NAVER_SC_SETUP.md 확인 완료).

## 대안 경로

### 1. Sitemap Ping (수동, 권장)
배포 직후 또는 콘텐츠 대량 업데이트 후 수동 핑:
```
https://searchadvisor.naver.com/sitemap/ping?url=https://kadeora.app/sitemap.xml
```
브라우저 주소창에 붙여넣으면 즉시 재수집 트리거. 자동화는 OAuth 등 비정상 경로 필요.

### 2. 수집 요청 (긴급) — 최대 일 500 URL
- https://searchadvisor.naver.com → 요청 → 수집요청 → 주요 path 일괄 입력
- API 없음, 웹 UI 직접 작업

### 3. RSS 피드 제출
- https://kadeora.app/rss.xml 주소 제출 (기존 존재 확인)
- 네이버는 RSS 기반 부분 자동 색인

### 4. IndexNow (Bing + Yandex)
```
POST https://api.indexnow.org/indexnow
Body: {
  "host": "kadeora.app",
  "key": "<INDEXNOW_KEY>",
  "urlList": ["https://kadeora.app/apt/...", ...]
}
```
- `.env.local` 에 `INDEXNOW_KEY` 존재 → `/indexnow/<key>.txt` 경로에 키 파일 배포 필요
- 네이버 지원 안 함

## 자동화 후보
- `scripts/naver-sitemap-ping.mjs` — sitemap.xml 20개 순회하며 ping URL fetch
- 단, 공식 수집 보장 없음 (Crawler 재방문 trigger 정도)

## 권장
매주 Node 수동:
1. https://searchadvisor.naver.com 접속
2. 사이트맵 20개 제출 버튼 (이미 등록돼있으면 재검증)
3. 수집요청 3건 입력: `/`, `/blog`, `/apt`

공식 API 출시 시 (지원 예정 불확실) `/api/cron/naver-sc-submit` 신설 가능.
