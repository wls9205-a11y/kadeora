import type { Metadata } from 'next';
import { Suspense } from 'react';
import DiscussClient from './DiscussClient';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 0;

export const metadata: Metadata = {
  title: '토론 | 카더라',
  description: '지금 뜨거운 토론과 실시간 라운지',
};

export default function DiscussPage() {
  return (
    <Suspense>
      <DiscussClient />
      <Disclaimer />
    </Suspense>
  );
}
