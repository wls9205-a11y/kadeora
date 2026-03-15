import { Suspense } from 'react';
import OnboardingClient from './OnboardingClient';
export const metadata = { title: '시작하기 | 카더라' };
export default function OnboardingPage() {
  return <Suspense><OnboardingClient /></Suspense>;
}