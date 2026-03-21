import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '자주 묻는 질문',
  description: '카더라 서비스 이용 관련 자주 묻는 질문과 답변',
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
