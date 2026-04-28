// Kadeora Service Worker v2
const CACHE_VERSION = '202604280721';
const CACHE_NAME = 'kadeora-v' + CACHE_VERSION;
const PRECACHE = ['/feed', '/offline.html', '/icons/icon-192.png', '/blog', '/apt'];
const OFFLINE_PAGES = ['/feed', '/stock', '/hot', '/apt', '/blog'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('kadeora-') && k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

// Web Push 수신 — 태그로 중복 방지 + 이미지 지원
self.addEventListener('push', e => {
  if (!e.data) return;
  try {
    const data = e.data.json();
    const options = {
      body: data.body || '카더라에 새 알림이 있습니다',
      icon: data.icon || '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      image: data.image || undefined,
      tag: data.tag || 'kadeora-default',
      renotify: !!data.tag,
      vibrate: [100, 50, 100],
      silent: data.silent || false,
      requireInteraction: data.important || false,
      timestamp: Date.now(),
      data: { url: data.url || '/', log_id: data.log_id || null },
      actions: [
        { action: 'open', title: '바로가기' },
        { action: 'close', title: '닫기' },
      ],
    };
    e.waitUntil(self.registration.showNotification(data.title || '카더라', options)
      .then(() => { if ('setAppBadge' in navigator) navigator.setAppBadge(); })
    );
  } catch (err) {
    e.waitUntil(
      self.registration.showNotification('카더라', { body: '새 알림이 있습니다', icon: '/icons/icon-192.png' })
    );
  }
});

// 알림 클릭 → 클릭 로그 + 페이지 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'close') return;
  if ('clearAppBadge' in navigator) navigator.clearAppBadge();
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
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        for (const c of list) {
          if (new URL(c.url).pathname === new URL(url, self.location.origin).pathname && 'focus' in c) {
            return c.focus();
          }
        }
        return clients.openWindow(url);
      }),
    ])
  );
});

// 푸시 구독 변경 시 자동 재구독
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.registration.pushManager.subscribe(e.oldSubscription?.options || { userVisibleOnly: true })
      .then(sub => fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), resubscribe: true }),
      }))
      .catch(() => {})
  );
});

// 캐시 전략
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;

  // 정적 자산: Cache First
  if (url.pathname.startsWith('/_next/static/') || url.pathname.match(/\.(png|jpg|svg|ico|woff2?|css|js)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) { const c = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(e.request, c)); }
        return res;
      }))
    );
    return;
  }

  // 페이지: Network First → 캐시 → offline.html
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && OFFLINE_PAGES.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))) {
        const c = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, c));
      }
      return res;
    }).catch(() => caches.match(e.request).then(c => c || caches.match('/offline.html')))
  );
});
