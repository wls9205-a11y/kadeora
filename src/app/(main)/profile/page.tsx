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
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', color:'var(--text-secondary)', fontSize:14 }}>
      잠시만요...
    </div>
  );
}
