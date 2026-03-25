import { Suspense } from 'react';
import OnboardingClient from './OnboardingClient';
export const metadata = { title: '시작하기', robots: { index: false, follow: false } };
export default function OnboardingPage() {
  return <Suspense><OnboardingClient /></Suspense>;
}