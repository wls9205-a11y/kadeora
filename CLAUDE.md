# 카더라 알림·상점·마케팅 전략 — 통합 개선안

---

## PART 1: 알림 피로도 해결 — 관심 기반 알림 시스템

### 문제
현재 푸시 알림이 전체 유저에게 일괄 발송되면 스팸으로 느껴져서 알림을 끄거나 이탈합니다.

### 해결: notification_settings 테이블 + 관심 종목/단지

#### 1-1. DB 마이그레이션 — 알림 설정 테이블
```sql
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  -- 카테고리별 ON/OFF
  push_comments boolean DEFAULT true,       -- 내 글에 댓글
  push_likes boolean DEFAULT true,           -- 내 글에 좋아요
  push_follows boolean DEFAULT true,         -- 팔로우
  push_apt_deadline boolean DEFAULT true,    -- 관심 청약 마감
  push_stock_alert boolean DEFAULT true,     -- 관심 종목 급등락
  push_daily_digest boolean DEFAULT false,   -- 일일 요약 (기본 OFF)
  push_attendance boolean DEFAULT false,     -- 출석 리마인더 (기본 OFF)
  push_hot_post boolean DEFAULT false,       -- HOT 게시글 (기본 OFF)
  push_news boolean DEFAULT false,           -- 뉴스 알림 (기본 OFF)
  -- 방해 금지
  quiet_start time DEFAULT '22:00',          -- 밤 10시~
  quiet_end time DEFAULT '08:00',            -- ~아침 8시
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 관심 종목 (최대 20개)
CREATE TABLE IF NOT EXISTS stock_watchlist (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  symbol text NOT NULL REFERENCES stock_quotes(symbol),
  alert_threshold numeric DEFAULT 5.0,  -- ±5% 변동 시 알림
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, symbol)
);

-- RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인만 읽기" ON notification_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "본인만 수정" ON notification_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE stock_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인만" ON stock_watchlist FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

#### 1-2. 알림 발송 로직 개선
```
모든 푸시 크론에서:
1. notification_settings에서 해당 카테고리가 true인 유저만 대상
2. quiet_start ~ quiet_end 시간대면 발송 보류
3. 관심 종목 알림: stock_watchlist에 있는 종목만 → 해당 유저에게만
4. 관심 청약 알림: apt_alerts에 있는 단지만 → 해당 유저에게만

기본값 전략 (중요):
- 내 글 반응 (댓글/좋아요/팔로우): 기본 ON → 유저가 직접 끔
- 마케팅성 알림 (뉴스/HOT/출석): 기본 OFF → 유저가 켜야 받음
- 이렇게 하면 가입 직후 스팸 느낌 없이, 원하는 유저만 구독
```

#### 1-3. 알림 설정 UI
```
프로필 > 알림 설정 (/profile/notifications):

┌──────────────────────────────────┐
│ 🔔 알림 설정                     │
├──────────────────────────────────┤
│ 내 활동                          │
│ ✅ 내 글에 댓글                  │
│ ✅ 내 글에 좋아요                │
│ ✅ 새 팔로워                     │
├──────────────────────────────────┤
│ 관심 정보                        │
│ ✅ 관심 청약 마감 알림           │
│ ✅ 관심 종목 급등/급락           │
│ ⬜ 이번 주 HOT 게시글            │
├──────────────────────────────────┤
│ 기타                             │
│ ⬜ 출석 리마인더                 │
│ ⬜ 오전 경제 뉴스                │
│ ⬜ 일일 요약                     │
├──────────────────────────────────┤
│ 방해 금지 시간                   │
│ 22:00 ~ 08:00                    │
└──────────────────────────────────┘
```

---

## PART 2: 상점 상품 검토 — 과한 것 정리

### 현재 포인트 분포 (실제 유저 11명)
- 0~200P: 4명 (신규 가입자)
- 501~1000P: 1명
- 3000P+: 6명 (활성 유저)
- 평균: 10,055P (Ss 81,437P가 올려놓음)

### 문제점 분석
```
현재 활성 상품 11개 중:
- 이모지 팩 200P → 구현 안 됨 (특별 이모지가 뭔지 정의 없음) → 제거
- 아바타 프레임 300P → 구현 안 됨 (프레임 CSS 없음) → 제거
- 프로필 배경 500P → 구현 안 됨 → 제거
- 포인트 2배 부스터 1500P → 구현 복잡 (모든 포인트 적립 로직에 체크 필요) → 보류
- 익명 게시권 800P → 구현 필요 (WriteClient에 체크 로직) → 유지하되 보류
- 핀 고정 4000P → 유저 11명에게 핀 고정은 의미 없음 → 비활성화
- 토론방 개설 5000P → 토론방 자체 활성화 안 됨 → 비활성화

실제로 당장 작동하는 것:
✅ 닉네임 변경권 500P — 구현 완료
✅ 프리미엄 배지 1000P — 구현 완료 (닉네임 옆 배지)
✅ 게시글 부스트 2000P — 구현 완료 (인기 피드 상단 노출)
✅ 전광판 확성기 3000P — 구현 완료 (피드 상단 전광판)
```

### 개선안: 작동하는 4개만 활성화, 나머지 비활성
```sql
-- 구현 안 된 상품 비활성화
UPDATE shop_products SET is_active = false 
WHERE id IN ('emoji_pack', 'custom_avatar_frame', 'profile_bg', 'double_points_24h', 
             'anonymous_post', 'pin_post', 'create_room');

-- 작동하는 4개만 유지
-- nickname_change 500P ✅
-- premium_badge 1000P ✅  
-- post_boost 2000P ✅
-- megaphone 3000P ✅
```

---

## PART 3: SEO/GEO + 마케팅 — 실제 유저 유입 전략

### 3-1. 치명적 발견: 구글에 인덱싱 안 됨
"site:kadeora.app" 검색 결과 0건. 구글이 kadeora.app을 아예 모릅니다.

#### 즉시 해야 할 SEO 작업 (Claude Code):

```
1. robots.txt 확인/생성 (/public/robots.txt)
   User-agent: *
   Allow: /
   Sitemap: https://kadeora.app/sitemap.xml

2. sitemap.xml 동적 생성 (/app/sitemap.ts)
   - /feed (메인)
   - /feed/[slug] (모든 게시글 — 3672개)
   - /stock (주식)
   - /stock/[symbol] (종목별)
   - /apt (부동산)
   - /hot (인기)
   - /guide (가이드)
   - /login, /terms, /privacy
   
3. 각 페이지 메타데이터 개선
   - feed: "카더라 - 대한민국 주식·부동산 소리소문 커뮤니티"
   - feed/[id]: 게시글 제목 + 본문 앞 100자 + OG 이미지
   - stock: "실시간 주식시세 | 카더라"
   - apt: "아파트 청약 일정 | 카더라"

4. Google Search Console 등록
   - https://search.google.com/search-console
   - kadeora.app 도메인 인증 (DNS TXT 레코드)
   - sitemap.xml 제출

5. 네이버 서치어드바이저 등록
   - https://searchadvisor.naver.com
   - 한국 유저 대상이므로 네이버 인덱싱 필수
```

### 3-2. 내가 직접 할 수 있는 마케팅 작업

#### A. 블로그/콘텐츠 SEO (가장 효과적)
```
/blog 경로 추가 — 매주 자동 발행되는 SEO 콘텐츠:

1. "이번 주 청약 일정 총정리" (매주 월요일)
   - apt_subscriptions 데이터로 자동 생성
   - "2026년 3월 4주차 아파트 청약 일정"
   - 키워드: 아파트 청약, 청약 일정, 청약 마감
   
2. "오늘의 코스피/코스닥 시세" (매일)
   - stock_quotes 데이터로 자동 생성
   - "2026년 3월 21일 코스피 시총 TOP 10"
   - 키워드: 코스피 시세, 주식 시세, 오늘 주가
   
3. "미분양 아파트 현황" (매주)
   - unsold_apts 데이터로 자동 생성
   - "경기도 미분양 아파트 7곳 — 분양가 3억대"
   - 키워드: 미분양 아파트, 미분양 현황, 분양가

→ 이 페이지들이 구글/네이버에 인덱싱되면 검색 유입 시작
→ /api/cron/blog-generator로 자동화 가능
```

#### B. 구조화 데이터 (JSON-LD)
```
모든 페이지에 적절한 구조화 데이터:
- 게시글: Article schema
- 주식: FinancialProduct schema  
- 청약: Event schema (접수 시작/마감일)
- 커뮤니티: WebSite + SearchAction schema

→ 구글 리치 스니펫에 노출 → 클릭률 상승
```

#### C. 외부 플랫폼 콘텐츠 발행 (백링크)
```
내가 직접 발행 가능한 플랫폼:

1. 네이버 블로그 (가장 중요)
   - "카더라" 공식 블로그 개설
   - 매주 "이번 주 청약 일정", "주식 시세 요약" 발행
   - 본문 하단에 kadeora.app 링크
   - 네이버 검색에서 블로그 노출 → 유입

2. 티스토리 블로그 (구글 SEO)
   - 구글 인덱싱이 잘 됨
   - 동일 콘텐츠를 약간 변형해서 발행
   - 백링크 효과

3. GitHub Pages (기술 블로그)
   - "카더라 기술 블로그" — 개발 과정 공유
   - 개발자 커뮤니티에서 백링크

4. Product Hunt / Hacker News
   - 영문 소개: "Kadeora - Korean Stock & Real Estate Community"
   - 해외 백링크 확보

5. 주식/부동산 커뮤니티 직접 참여
   - 에펨코리아 주식 게시판: 유용한 정보 글 + 출처로 카더라 링크
   - 클리앙 주식한당: 시세 분석 글 + 카더라 링크
   - 뽐뿌 증권포럼: 청약 정보 + 카더라 링크
   - 부동산스터디 (네이버카페 198만): 청약 일정 정리 + 카더라 링크
     ※ 단, 노골적 홍보는 금지 → "정보 공유" 형태로
```

#### D. 소셜 미디어
```
1. X (트위터) 자동 발행
   - 매일 "오늘의 경제 뉴스 3줄 요약" → 시드 게시글과 연동
   - 해시태그: #주식 #부동산 #청약 #코스피 #카더라
   - /api/cron/tweet-auto (크론)

2. 카카오 플러스친구 / 채널
   - "카더라" 채널 개설
   - 청약 마감 알림을 카카오 채널로도 발송
```

### 3-3. 백링크 전략 — 직접 구축 가능한 것

```
Tier 1 (직접 소유 — 가장 신뢰):
- kadeora.net → kadeora.app 301 리다이렉트 (이미 소유)
- 네이버 블로그 → kadeora.app
- 티스토리 → kadeora.app  
- GitHub → kadeora.app

Tier 2 (프로필 백링크):
- Google 비즈니스 프로필 등록
- 네이버 MY플레이스 등록
- ProductHunt 등록
- AlternativeTo 등록 (한국 커뮤니티 앱 카테고리)
- Crunchbase 등록

Tier 3 (콘텐츠 백링크):
- 에펨코리아, 클리앙, 뽐뿌 등에서 정보성 글 발행
- Quora/Reddit 한국 주식 관련 답변
- 인디해커스/미디엄 기술 글
```

### 3-4. 자동 SEO 콘텐츠 생성 API (Claude Code 구현 가능)

```
/api/cron/seo-blog (매일 07:00):
1. apt_subscriptions에서 이번 주 청약 조회
2. stock_quotes에서 오늘 시세 TOP 10 조회
3. 자동으로 /blog/[date]-weekly-apt, /blog/[date]-stock-top10 페이지 생성
4. sitemap.xml에 자동 추가
5. (선택) 네이버 블로그 API로 자동 발행

이 페이지들은 "2026년 3월 4주차 아파트 청약"으로 검색하면 노출됨
```

---

## Claude Code 작업 지시서

### Phase 1: 즉시 실행 (SEO 기본)
```
1. /app/sitemap.ts 생성 — 동적 sitemap (게시글 3672개 + 주식 150개 + 청약 106개)
2. /public/robots.txt 확인/생성
3. 모든 페이지 metadata 개선 (title, description, OG)
4. JSON-LD 구조화 데이터 추가 (Article, WebSite)
```

### Phase 2: 알림 설정 시스템
```
5. notification_settings + stock_watchlist 테이블 생성 (Supabase MCP)
6. /profile/notifications 알림 설정 UI
7. 기존 푸시 크론에 설정 체크 로직 추가
```

### Phase 3: 상점 정리
```
8. 구현 안 된 상품 7개 비활성화 (Supabase MCP)
9. 작동하는 4개만 깔끔하게 표시
```

### Phase 4: 블로그 자동 생성
```
10. /app/blog/page.tsx — 블로그 메인
11. /api/cron/seo-blog — 자동 콘텐츠 생성
12. sitemap에 블로그 경로 추가
```

```
소스코드 전부 읽어:
cat src/app/sitemap.ts 2>/dev/null || echo "없음"
cat public/robots.txt 2>/dev/null || echo "없음"
cat src/app/layout.tsx | head -50

Phase 1~3을 순서대로:
1. sitemap.ts 동적 생성
2. robots.txt 생성
3. 각 페이지 metadata 개선 + JSON-LD
4. notification_settings + stock_watchlist 테이블 (Supabase MCP)
5. 구현 안 된 상점 상품 비활성화 (Supabase MCP)

각 단계 npm run build → 커밋 → push. 논스톱.
```
