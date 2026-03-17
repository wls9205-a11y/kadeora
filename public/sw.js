// Kadeora Service Worker — CACHE_VERSION은 빌드 스크립트가 주입
const CACHE_VERSION = '20260318';
const CACHE_NAME = 'kadeora-v' + CACHE_VERSION;

self.addEventListener('install', e => {
  self.skipWaiting();
});

// activate 시 이전 버전 캐시 삭제
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith('kadeora-') && k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => clients.claim())
  );
});

// Web Push 수신
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  const options = {
    body: data.body || '카더라에 새 알림이 있습니다',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: '바로가기' },
      { action: 'close', title: '닫기' },
    ],
  };
  e.waitUntil(
    self.registration.showNotification(data.title || '카더라', options)
  );
});

// 알림 클릭 → 페이지 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'close') return;
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if (c.url.includes(url) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// 오프라인 캐시 (피드 페이지)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;
  // 네트워크 우선, 실패 시 캐시
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
