import UserDetailClient from './UserDetailClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '유저 상세 — 어드민' };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetailClient userId={id} />;
}
