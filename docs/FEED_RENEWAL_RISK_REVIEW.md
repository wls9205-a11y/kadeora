# 피드 리뉴얼 리스크 검토
> 2026-04-13

## 배포 전 필수 체크리스트

### 🔴 Critical — 반드시 확인

1. **DB 마이그레이션 순서**
   - `point_reason` enum `ALTER TYPE ... ADD VALUE IF NOT EXISTS` → 반드시 마이그레이션 먼저 실행
   - 코드 배포보다 마이그레이션이 먼저 완료되어야 함
   - Supabase Dashboard → SQL Editor에서 `supabase/migrations/20260413_feed_renewal.sql` 전문 실행
   - 실행 후 확인: `SELECT * FROM post_polls LIMIT 1;` (테이블 존재 확인)

2. **`update_user_grade()` 트리거 충돌**
   - 새 post_type (short/poll/vs/predict) INSERT 시 트리거가 points를 덮어쓸 수 있음
   - 마이그레이션 실행 후 트리거 코드 확인 필요:
     ```sql
     SELECT prosrc FROM pg_proc WHERE proname = 'update_user_grade';
     ```
   - `award_points` RPC가 `PERFORM set_config('app.allow_points_update', 'on', true)` 사용 중인지 확인

3. **TypeScript 타입 동기화**
   - `post_type` 컬럼은 PostWithProfile에 optional로 추가됨
   - 마이그레이션 후 `npx supabase gen types typescript` 재실행 권장
   - 재생성 전까지는 `post_type?: string` 으로 동작

### 🟡 Medium — 주의 필요

4. **RLS 정책**
   - 새 테이블(post_polls, poll_options, poll_votes, vs_battles, vs_votes, predictions, prediction_votes) 모두 RLS enabled
   - SELECT: 모두 허용 (public)
   - INSERT: `auth.uid() = user_id` 체크
   - 투표 생성(post_polls, poll_options)은 posts INSERT와 함께 서버에서 처리하므로 별도 INSERT 정책 불필요
   - ⚠️ 만약 RLS가 INSERT를 막으면: API 라우트에서 service_role 사용 필요

5. **기존 피드 호환성**
   - 기존 posts에는 `post_type` 컬럼이 없었음 → DEFAULT 'post' 설정
   - FeedClient에서 `post.post_type ?? 'post'`로 fallback 처리됨
   - 기존 글은 모두 일반 카드로 렌더링 (영향 없음)

6. **QuickPostBar 로그인 처리**
   - 비로그인 상태에서 클릭 시 `/login?redirect=/feed` 리다이렉트
   - 로그인 후 돌아와서 QuickPost 상태 유지 안 됨 (acceptable)

7. **투표 만료 처리**
   - `post_polls.expires_at` 체크는 API에서만 (클라이언트 시간 신뢰 불가)
   - 만료된 투표는 새 투표 불가, 결과만 보기
   - 만료 체크 cron은 추후 구현 필요

### 🟢 Low — 알아두기

8. **핫토픽 성능**
   - `get_hot_topics` RPC는 최근 24시간 내 posts 스캔
   - 게시글 수가 적은 현재 단계에서는 문제 없음
   - 게시글 10만+ 시 materialized view 전환 고려

9. **FeedPollCard/VSCard/PredictCard 네트워크 호출**
   - 각 카드가 마운트 시 독립적으로 데이터 로드
   - 피드에 투표/VS/예측이 많으면 동시 요청 급증 가능
   - 추후 피드 API에서 통합 조회로 최적화 가능

10. **새 컴포넌트 경로**
    - `src/components/feed/` 디렉토리 신설
    - 기존 컴포넌트와 충돌 없음

## 배포 순서

```
1. Supabase SQL Editor → 20260413_feed_renewal.sql 실행
2. 마이그레이션 완료 확인 (테이블, enum, RPC 존재 확인)
3. git add -A && git commit && git push
4. Vercel 자동 배포 대기
5. 배포 완료 후 /feed 접속 → QuickPostBar 렌더링 확인
6. 한마디 작성 테스트 → 포인트 +5 확인
7. 투표 생성 + 참여 테스트
8. 우리동네 탭 → 지역 미설정 시 안내 확인
9. 더보기 → 우리동네 설정 / 관심사 설정 접근 확인
```

## 롤백 계획

- 코드 문제: `git revert` → Vercel 재배포
- DB 문제: 새 테이블은 독립적이므로 DROP 가능 (기존 데이터 영향 없음)
- `posts.post_type` 컬럼: DEFAULT 'post'이므로 기존 기능 영향 없음
