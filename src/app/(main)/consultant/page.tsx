import type { Metadata } from 'next';
import ConsultantRegister from './ConsultantRegister';

export const metadata: Metadata = {
  title: '분양 상담사 등록',
  description: '카더라에서 분양 상담사로 등록하고 프리미엄 리스팅으로 고객을 만나세요.',
  robots: { index: false, follow: false },
};

export default function ConsultantPage() {
  return <ConsultantRegister />;
}
