// V16 D — 어드민 한 줄 입력.
//
// Node 가 남보다 빠른 이유는 크롤러가 아니라 사람이다.
// 총회장에서 듣는 정보가 들어올 문이 지금까지 없었다.

import type { Metadata } from 'next';
import StageInputClient from './StageInputClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '현장 단계 입력 | 카더라 어드민',
  robots: { index: false, follow: false },
};

export default function AdminAptStagePage() {
  return <StageInputClient />;
}
