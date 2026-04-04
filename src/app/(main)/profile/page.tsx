'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function ProfileRedirect() {
  const router = useRouter();
  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(`/profile/${user.id}`);
      else router.replace('/login');
    });
  }, [router]);
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', color:'var(--text-tertiary)', fontSize:14 }} aria-busy="true">
      <div style={{ width:24, height:24, border:'2px solid var(--border)', borderTopColor:'var(--brand)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
