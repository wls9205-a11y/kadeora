## 세션 110 — SEO 종합 감사 33건 수정 (네이버 포털 1위 최적화)

### 브랜치: seo/mega-audit-33fixes
### 커밋: 3294e844, 91ea21f0, 03f92fb4 — push 완료 (배포 보류)
### 변경: 17파일 총, +103 -38

### 감사 범위
- 코드 514파일 전수검사 + 프로덕션 실측 + Google/Naver 검색결과 확인
- S급 3건 + A급 11건 + B급 11건 + C급 8건 = 총 33건 발견, 31건 코드 수정

### S급 수정 (네이버 차단 해제)
1. ✅ S-1: Yeti 봇 인식 추가 (`naverbot` → `yeti|naverbot|daumcrawler`)
   - 이전: Naver Yeti가 non-bot 처리 → isAccessibleForFree:false → 전체 블로그 "유료 콘텐츠" 마킹
   - 수정: blog/[slug]/page.tsx:290 봇 regex에 `yeti` 추가
2. ✅ S-2: blog?q= 검색결과 페이지 noindex (`pageNum > 1 || q`)
3. ✅ S-3: 홈 타이틀 '부동산·주식' 키워드 포함

### A급 수정 (캐러셀/리치스니펫)
4. ✅ A-1: 주식 ItemList에 image+description 추가
5. ✅ A-2: article:tag 개별 meta 태그 (쉼표→개별)
6. ✅ A-3: og:image:alt + naver:imagesearch 메타태그
7. ✅ A-4: 블로그 본문 img width/height + aspect-ratio 추가
8. ✅ A-5: Hidden H1 → sr-only (스팸 패널티 방지)
9. ✅ A-6: og-chart 캐시 1h→6h
10. ✅ A-7: BUILD_DATE 동적화
11. ✅ A-8: 중복 WebSite JSON-LD 제거 (page.tsx)
12. ✅ A-9: Last-Modified 매요청갱신 제거 (크롤예산 보호)
13. ✅ A-10: 외부 링크 nofollow 추가 (PageRank 유출 방지)
14. ✅ A-11: apt/search noindex

### B급 수정 (캐러셀 최적화)
15. ✅ B-1: 본문 실제 이미지 추출 → JSON-LD image 배열 선두 배치
16. ✅ B-2: 블로그 리스트 cover_image 없는 포스트에 OG 이미지 폴백
17. ✅ B-3: image-sitemap geo_location (부동산 이미지)
18. ✅ B-4: 빈 alt 텍스트 자동 보강 ("이미지"→"[제목] 관련 이미지")
19. ✅ B-5/B-8: RSS 50→100개, apt 30/20→60/40개
20. ✅ B-6: hreflang ko + x-default 태그
21. ✅ B-7: font-display:swap 보험
22. ✅ B-9: 댓글 이미지 링크 rel=nofollow ugc
23. ✅ B-10: apt/theme canonical에서 region 파라미터 제거
24. ✅ B-11: Content-Language: ko 헤더

### C급 수정 (노출면적 확대)
25. ✅ C-1: 부동산+주식 허브 SEO 텍스트 추가
26. ✅ C-2: Speakable cssSelector 확장 (h2, .faq-answer)
27. ✅ C-3: apt/[id] Residence+GeoCoordinates 스키마
28. ✅ C-4: discussion redirect 페이지 noindex
29. ✅ C-7: stock/apt noscript 폴백

### PENDING (코드 외적 조치)
- ⬜ C-5: 네이버 서치어드바이저에서 RSS(/blog/feed) + 사이트맵 수동 제출 확인
- ⬜ C-8: INDEXNOW_KEY env 값 = public/3a23def313e1b1283822c54a0f9a5675.txt 일치 확인
- ⬜ Google Search Console에서 `blog?q=` 패턴 URL 일괄 삭제 요청
- ⬜ 배포 후 네이버 서치어드바이저 "페이지 수집 요청" 수동 실행

---
