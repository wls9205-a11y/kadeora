import AdminNav from './AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(8px, 2vw, 16px) clamp(12px, 3vw, 24px) 80px' }}>
      <AdminNav />
      {children}
      <style>{`
        @media (max-width: 640px) {
          .cc-section [style*="grid-template-columns: 1fr 1fr"],
          .cc-section [style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
          .cc-section [style*="repeat(4, 1fr)"] { grid-template-columns: repeat(2, 1fr) !important; }
          .cc-section [style*="repeat(3, 1fr)"] { grid-template-columns: repeat(2, 1fr) !important; }
          table { font-size: 11px !important; }
          table td, table th { padding: 4px 6px !important; }
        }
      `}</style>
    </div>
  );
}
