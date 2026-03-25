'use client';
import dynamic from 'next/dynamic';

const MissionControl = dynamic(() => import('./MissionControl'), { ssr: false });

export default function AdminPage() {
  return <MissionControl />;
}
