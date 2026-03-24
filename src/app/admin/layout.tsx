import AdminNav from './AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(8px, 2vw, 16px) clamp(12px, 3vw, 24px) 80px' }}>
      <AdminNav />
      {children}
    </div>
  );
}
