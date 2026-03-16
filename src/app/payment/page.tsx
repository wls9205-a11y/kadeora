import type { Metadata } from 'next';
import { Suspense } from 'react';
import PaymentClient from './PaymentClient';

export const metadata: Metadata = { title: '결제 | 카더라', robots: { index: false, follow: false } };
export default function PaymentPage() {
  return <Suspense fallback={null}><PaymentClient /></Suspense>;
}