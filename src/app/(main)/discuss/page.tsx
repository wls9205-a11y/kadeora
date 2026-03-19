import type { Metadata } from 'next';
import { Suspense } from 'react';
import DiscussClient from './DiscussClient';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 0;

export const metadata: Metadata = {
  title: '카더라 라운지',
  description: '실시간 채팅으로 소문을 나누는 카더라 라운지',
};

export default function DiscussPage() {
  return (
    <Suspense>
      <DiscussClient />
      <Disclaimer />
    </Suspense>
  );
}
