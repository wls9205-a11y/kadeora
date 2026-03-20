# 카더라 현재 상태 피드백 (2026-03-21)

## 잘 된 점
- SSR 기반 SEO: 게시글 3,656개 모두 서버 렌더링, 한글 slug URL, OG 이미지 동적 생성
- 실시간 기능: 라운지 채팅 Supabase Realtime, 답글 스레드, @멘션, 이모지 리액션
- 어드민 시스템: 서버사이드 페이지네이션, 벌크 액션, 다크 사이드바, KPI 대시보드
- 캐싱 전략: 페이지별 revalidate 통일 (60/120/300/3600), ISR + revalidatePath
- 보안: RLS 17개 테이블 전체 활성화, CRON_SECRET 통일, 어드민 middleware 체크
- 코드 품질: getAvatarColor/CATEGORY_STYLES 통합, EmptyState 공통 컴포넌트, lucide 아이콘

## 아직 부족한 점 (우선순위순)
1. **카카오톡 공유**: SDK Script 로드가 누락되어 있었음 → 수정했지만 카카오 개발자 콘솔에서 kadeora.app 도메인 등록 필수 (코드로 해결 불가)
2. **포인트 시스템 미완성**: 글+10P/댓글+5P 적립만 있고, 포인트로 구매/사용하는 흐름 미구현. point_history 테이블 INSERT 없음
3. **등급 자동 갱신 없음**: profiles.grade가 수동으로만 변경됨. 포인트 기반 자동 등급 갱신 크론 필요
4. **검색 품질**: title ILIKE 단순 검색만 있고 Full-Text Search(FTS) 미적용. 3,600+ 게시글에서 검색 정확도 낮음
5. **이미지 업로드**: ImageUpload 컴포넌트 존재하지만 Supabase Storage 연동 미확인. 파일 크기 제한 미설정
6. **댓글 입력**: 하단 고정(fixed bottom)이 아닌 인라인 방식. 모바일에서 스크롤 후 댓글 입력이 불편
7. **알림 실시간**: 폴링 방식 (페이지 로드 시 1회 조회). Realtime 구독으로 전환하면 UX 향상

## 추가 개선 제안

### 기능
- 해시태그 기반 관련 글 추천 (현재는 같은 카테고리로만)
- 인기 검색어 실시간 업데이트 (현재 600초 캐시)
- 주식 종목 즐겨찾기/알림
- 게시글 임시저장 (localStorage draft)

### 디자인
- 라이트모드 지원 (현재 다크모드 전용 — 일부 유저 이탈 가능)
- PostCard 이미지 썸네일 (현재 텍스트만)
- 스켈레톤 로딩 stock/apt/discuss에도 적용

### 성능
- 어드민 대시보드 개별 쿼리 20개 → RPC 1~2개로 합치기
- Supabase Connection Pooler 사용 확인 (cold start 최적화)
- next/image 더 적극 활용 (아바타 이미지 등)

### 수익화
- 전광판 유료 노출: shop_products 등록됨, 결제 흐름(토스페이먼츠) 테스트키 상태
- 확성기(megaphones): 상점 상품 존재하지만 실제 피드 노출 미구현
- 프리미엄 뱃지/프로필 꾸미기: 미구현

## 유저 유입을 위해 당장 해야 할 것
1. **카카오 개발자 콘솔에 kadeora.app 도메인 등록** → 카카오톡 공유 활성화
2. **구글 서치 콘솔 등록 + sitemap 제출** → 3,656개 게시글 색인
3. **시드 콘텐츠 품질 향상**: Haiku 생성 비율 높이기 (현재 템플릿 반복 → 중복 느낌)
4. **소셜 미리보기(OG) 테스트**: 카카오/X/밴드 각각에서 링크 공유 시 미리보기 확인
5. **모바일 PWA 설치 유도**: 인스톨 배너가 있으니 적극 노출

## 기술 부채
- 어드민 posts 3,656개 전체 로드 → 서버사이드 페이지네이션 전환 완료, 하지만 comments 페이지는 아직 클라이언트 페이지네이션
- TypeScript any 타입 다수 존재 (Supabase 응답 처리 부분)
- console.error 외 에러 로깅 체계 부재 (Sentry 설정됨, captureException은 error.tsx에만)
- 테스트 코드 부재: unit test, e2e test 모두 없음
- CSS-in-JS 인라인 스타일 과다 → Tailwind 클래스로 점진 전환 필요
- Supabase 타입 자동생성(gen types) 미사용 → types/database.ts 수동 관리
