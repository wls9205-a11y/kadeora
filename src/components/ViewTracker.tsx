'use client';
import { useEffect } from 'react';

export function AptViewTracker({ siteId }: { siteId: string }) {
  useEffect(() => {
    if (!siteId) return;
    fetch('/api/apt/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId }) }).catch(() => {});
  }, [siteId]);
  return null;
}

export function BlogViewTracker({ blogId }: { blogId: string }) {
  useEffect(() => {
    if (!blogId) return;
    fetch('/api/blog/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blogId }) }).catch(() => {});
  }, [blogId]);
  return null;
}
