# 세션 18 — 블로그 스팸 방지 + 대량 시드 생성 + SEO 전면 최적화

**날짜**: 2026-03-22
**최종 커밋**: `803f0fa`

---

## 결과 요약

| 항목 | Before | After |
|------|--------|-------|
| 블로그 총 건수 | 2,055건 | **13,778건** (6.7배) |
| 발행 기간 | 12개월 (미래날짜 포함) | **24개월** (2024-03~2026-03) |
| 1000자 미만 | 다수 | **0건** |
| SEO 메타 누락 | 대부분 | **0건** (전 항목) |
| 제목 중복 | 1,147건 | **0건** |
| 쓰레기 데이터 | 193건 | **0건** (비공개) |
| 콘텐츠 다양성 | 템플릿 반복 | **99.9%** 고유 |
| sitemap | 5,000건 제한 | **전체 등재** (50,000 limit) |
| 저자 정보 | Organization | **Person + 직책** |
| 리라이팅 | 없음 | **자동 크론 9건/일** |

---

## 구축한 시스템

### 블로그 생성 → 발행 흐름
```
크론 11개 → safeBlogInsert() → is_published=false (큐)
      ↓
blog-publish-queue (09/13/18시) → blog_publish_from_queue() RPC
      ↓
is_published=true + published_at=NOW()
```

### AI 리라이팅 흐름
```
blog-rewrite 크론 (10:30/14:30/20:30) → Claude API Sonnet
      ↓
rewritten_at IS NULL 3건씩 → 5가지 랜덤 문체 리라이팅
```

### 어드민 (/admin → ⚡ 자동화)
- 발행 제어: 속도/상한/최소길이/유사도 실시간 변경
- 발행 큐 현황: 오늘발행/쿼터/대기/소진예상
- AI 리라이팅: 진행률 + 수동 5/10건 실행

---

## 신규/수정 파일

### 신규
```
src/lib/blog-safe-insert.ts
src/app/api/cron/blog-publish-queue/route.ts
src/app/api/cron/blog-rewrite/route.ts
src/app/api/admin/blog-rewrite/route.ts
```

### 수정
```
src/app/(main)/blog/page.tsx          — published_at 정렬, 미래글 필터
src/app/(main)/blog/[slug]/page.tsx   — JSON-LD Person 저자, OG 강화
src/app/sitemap.ts                    — limit 50000
src/app/admin/AdminAutomation.tsx     — 발행설정 + 리라이팅 패널
vercel.json                           — blog-rewrite 크론 3회
```

---

## DB 설정 (blog_publish_config)

| 설정 | 값 |
|------|---|
| daily_publish_limit | 3 |
| daily_create_limit | 10 |
| min_content_length | 1200 |
| title_similarity_threshold | 0.4 |
| auto_publish_enabled | true |

---

## 다음 세션 할 일

### 즉시
- [ ] Google Search Console sitemap 재제출
- [ ] 네이버 서치어드바이저 sitemap 제출
- [ ] 토스 라이브키 교체
- [ ] GitHub 토큰 삭제: https://github.com/settings/tokens

### 중기
- [ ] daily_publish_limit 3→10 올리기
- [ ] 리라이팅 크론 Vercel 로그 확인
- [ ] About 페이지 (저자 프로필)
- [ ] 비공개 708건 리뷰

### 장기
- [ ] 리라이팅 13,778건 모니터링
- [ ] 새 데이터 → 시드 RPC 재실행
- [ ] GSC 색인 현황/CWV 점검
