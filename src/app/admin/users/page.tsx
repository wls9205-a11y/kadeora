import UsersListClient from './UsersListClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '유저 — 어드민' };

export default function AdminUsersPage() {
  return <UsersListClient />;
}
