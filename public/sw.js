// Kadeora Service Worker — CACHE_VERSION은 빌드 스크립트가 주입
const CACHE_VERSION = '20260323';
const CACHE_NAME = 'kadeora-v' + CACHE_VERSION;
const PRECACHE = ['/feed', '/offline.html', '/icons/icon-192.png', '/blog', '/apt/map'];
const OFFLINE_PAGES = ['/feed', '/stock', '/hot', '/apt', '/blog'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
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
    data: { url: data.url || '/', log_id: data.log_id || null },
    actions: [
      { action: 'open', title: '바로가기' },
      { action: 'close', title: '닫기' },
    ],
  };
  e.waitUntil(
    self.registration.showNotification(data.title || '카더라', options)
  );
});

// 알림 클릭 → 클릭 로그 기록 + 페이지 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'close') return;
  const url = e.notification.data?.url || '/';
  const log_id = e.notification.data?.log_id;
  e.waitUntil(
    Promise.all([
      log_id
        ? fetch('/api/push/click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log_id }),
          }).catch(() => {})
        : Promise.resolve(),
      clients.matchAll({ type: 'window' }).then(list => {
        for (const c of list) {
          if (c.url.includes(url) && 'focus' in c) return c.focus();
        }
        return clients.openWindow(url);
      }),
    ])
  );
});

// 캐시 전략
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // API: Network only (no cache)
  if (url.pathname.startsWith('/api/')) return;

  // 정적 자산: Cache First
  if (url.pathname.startsWith('/_next/static/') || url.pathname.match(/\.(png|jpg|svg|ico|woff2?|css|js)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }))
    );
    return;
  }

  // 페이지: Network First, 오프라인 시 캐시 또는 offline.html
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && OFFLINE_PAGES.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return res;
    }).catch(() =>
      caches.match(e.request).then(cached => cached || caches.match('/offline.html'))
    )
  );
});
