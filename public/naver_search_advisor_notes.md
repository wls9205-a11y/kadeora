# 네이버 서치어드바이저 수동 확인 체크리스트

> searchadvisor.naver.com — Node가 수동으로 확인할 항목.
> 최초 1회만 수행, 이후 분기별 점검.

## 1. 사이트 등록 & 소유 확인
- [ ] 사이트 `https://kadeora.app/` 등록 완료 여부
- [ ] 소유 확인 파일 `public/3a23def313e1b1283822c54a0f9a5675.txt` 접근 가능 (200 OK)
- [ ] 소유 확인이 "확인됨" 상태인지

## 2. 사이트맵 제출
- [ ] `https://kadeora.app/sitemap.xml` 제출 → "수집 성공"
- [ ] `https://kadeora.app/news-sitemap.xml` 제출 (뉴스성 블로그 인덱싱)
- [ ] `https://kadeora.app/image-sitemap.xml` 제출 (네이버 이미지 탭 노출)

## 3. RSS 제출
- [ ] `https://kadeora.app/rss.xml` (메인 RSS)
- [ ] `https://kadeora.app/blog/feed` 등 카테고리별 피드

## 4. robots.txt 확인
- [ ] `Host: https://kadeora.app` 지시어 포함 (네이버 Yeti 권장)
- [ ] `User-agent: Yeti` 블록 존재 + `Allow: /blog/` 허용
- [ ] Disallow에 크리티컬 경로(`/admin/`, `/api/`, `/login` 등)만 포함

## 5. 네이버 요구 메타태그 (이미 코드에 반영됨)
- `naver:written_time`
- `naver:updated_time`
- `naver:author`
- `naver:description`
→ 추가 수정 불필요. 변경 시 `src/app/(main)/blog/[slug]/page.tsx` `generateMetadata.other` 참고.

## 6. 주요 URL 수동 요청
- [ ] `/` (홈)
- [ ] `/blog/레이카운티-무순위-청약-재분양-총정리-2026`
- [ ] `/blog/두산위브-트리니뷰-구명역-분양-총정리-2026`
- [ ] `/blog/guide-tax-regulated-area-2026`
- [ ] `/apt` (청약 리스트)
- [ ] `/stock` (종목 리스트)

## 7. 인덱스 현황 점검 (월 1회)
- [ ] 서치어드바이저 > "사이트 현황" > 수집/색인 지표 확인
- [ ] "웹 수집" 탭에서 차단된 URL 리스트 확인 → robots.txt 조정
- [ ] "네이버 랭킹" 탭에서 타깃 키워드(레이카운티, 두산위브 등) 노출 순위 확인

## 8. 장애 상황 대응
- 색인 감소 시: `sitemap.xml` `lastmod` 타임스탬프 업데이트가 되고 있는지 확인 (`src/app/sitemap.xml/route.ts` 참고)
- 404 다수 발생: Vercel deploy 롤백 여부 확인
- Crawl-delay 경고: `public/robots.txt` Yeti 블록 `Crawl-delay: 0` 유지

## 9. 네이버 인플루언서 / 카페 연동 (L0-3, L0-4 — 별도 작업)
- [L0-3] 네이버 인플루언서 신청 (searchadvisor 외부 경로)
- [L0-4] 카더라 공식 네이버 블로그 개설 (blog.naver.com)
→ 본 문서는 서치어드바이저 범위에 한정. 인플루언서·블로그는 별도 진행.
