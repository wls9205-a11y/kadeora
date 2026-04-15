## 세션 111 — 블로그 이미지 시스템 종합 감사 13건 수정

### 브랜치: fix/blog-image-audit-13fixes → main 머지 완료
### 커밋: e8c87208, d632eb02 — push 대기
### 변경: 10파일 총 + DB UPDATE 2건

### 감사 범위
- 블로그 이미지 파이프라인 전수 점검: 썸네일, 히어로 캐러셀, 본문 인라인 이미지, OG API
- DB 분석: blog_posts 7,690건 + blog_post_images 38,938건 + cover_image 패턴 + 인라인 이미지 URL
- S급 4건 + A급 4건 + B급 2건 + C급 3건 = 총 13건 발견, 전건 수정

### 핵심 발견
- 커버 이미지 73.5% (5,655건)가 OG 텍스트 배너 — 실사진 아님
- blog_post_images 80% (31,067건)가 OG URL — 히어로 캐러셀에 텍스트 배너 표시
- Naver Image Search API 완전 장애 — 최근 7일 실사진 0건 생성 (silent fail)
- 본문 89% (6,838건) 이미지 0장 — 텍스트 only
- Mixed Content: 687건 http:// 인라인 이미지 (브라우저 차단)

### DB 수정 (적용 완료)
1. ✅ 본문 인라인 이미지 http:// → https:// 일괄 치환 (687건)
2. ✅ 본문 og-infographic 마크다운 이미지 제거 (30건)

### S급 수정
3. ✅ S-1: Naver API 에러 로깅 — blog-generate-images + issue-draft 양쪽
4. ✅ S-3: 히어로 캐러셀 infographic 타입 필터 추가
5. ✅ S-4: marked 렌더러 http→https 자동 치환

### A급 수정
6. ✅ A-5: safeBlogInsert enrichContent og-infographic 자동 삽입 제거
7. ✅ A-6: blog-prompt-templates og-infographic URL 지시 제거
8. ✅ A-7: marked 렌더러 aspect-ratio:16/9 강제 제거 (이미지 찌그러짐 해소)
9. ✅ A-8: marked 렌더러 + 블로그 리스트 onerror 폴백 추가

### B급 수정
10. ✅ B-10: next.config remotePatterns 8개 외부 도메인 추가 + BlogHeroImage 조건부 최적화

### C급 수정
11. ✅ C-11: blog-visual-enhancer 데드코드 정리 (insertColorTags, insertCoverImage)
12. ✅ C-12: 블로그 리스트 (p.cover_image || true) 데드코드 제거
13. ✅ C-13: globals.css .blog-content img 3중 중복 → 통합 + border-radius 8px 통일

### PENDING (코드 외 조치)
- ⬜ Naver Image Search API 키 유효성 확인 (Vercel 로그에서 에러 원인 확인 필요)
- ⬜ Naver API 복구 후 기존 OG 커버 5,655건 실사진 교체 배치
- ⬜ 외부 핫링크 이미지 → Supabase Storage 프록시/캐시 (구조 개선)

---

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
