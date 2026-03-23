import AdminNav from './AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 16px 60px' }}>
      <AdminNav />
      {children}
    </div>
  );
}
