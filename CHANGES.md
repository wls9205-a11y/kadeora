# CHANGES — 2026-03-18

## TASK 1: feed/[id]/page.tsx 상단 중복 버튼 제거
- **결과**: 정적 버튼 블록 없음 확인 (PostActions.tsx 이미 삭제됨)
- **변경 파일**: 없음 (이미 해결 상태)

## TASK 2: 주식 페이지 데이터 신뢰도
- `src/app/(main)/stock/StockClient.tsx`
  - 변동률 0.00% → "–" 표시 (테이블 + 모달)
  - lastUpdated 비어있을 때 "장 마감 기준" 고정 텍스트
  - 검색 결과 없음 이모지 추가
- `src/app/(main)/stock/loading.tsx`
  - 스켈레톤 UI 개선 (헤더/필터바/테이블 행 분리, pulse 애니메이션)

## TASK 3: HOT 배지 동적화
- `src/app/(main)/feed/FeedClient.tsx`
  - 기존: likes_count > 200
  - 변경: likes_count >= 100 OR view_count >= 1000

## TASK 4: Empty State UI
- `src/components/CommentSection.tsx` — "💬 첫 댓글을 남겨보세요"
- `src/app/(main)/search/SearchClient.tsx` — "🔍 검색 결과가 없어요" (자동완성 + 본 검색)
- `src/app/(main)/stock/StockClient.tsx` — "🔍 검색 결과가 없어요"
- `src/app/(main)/profile/[id]/ProfileClient.tsx`
  - 내 글 없음: "✏️ 첫 글을 작성해보세요"
  - 내 댓글 없음: "💬 첫 댓글을 남겨보세요"
  - 북마크 없음: "🔖 저장한 글이 없어요"

## TASK 5: 금융 면책조항 공통 컴포넌트
- `src/components/Disclaimer.tsx` — 신규 생성
- 적용 페이지:
  - `src/app/(main)/feed/page.tsx`
  - `src/app/(main)/stock/page.tsx`
  - `src/app/(main)/apt/page.tsx`
  - `src/app/(main)/discuss/page.tsx`
