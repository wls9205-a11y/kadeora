// ⚠️ 이 파일이 «원본» 이다. 배포되는 것은 빌드가 만드는 public/sw.js 이고 그쪽은 추적하지 않는다.
//    scripts/inject-sw-version.mjs 가 아래 __CACHE_VERSION__ 을 치환해 public/sw.js 로 «쓴다».
//
//    ⛔ public/sw.js 를 직접 고치지 말 것 — 다음 빌드가 덮어쓴다. 여기를 고친다.
//    ⛔ __CACHE_VERSION__ 자리표시를 지우지 말 것 — 못 찾으면 빌드가 exit 1 로 죽는다.
//       (예전에는 console.warn 뒤 조용히 skip 했고, 그래서 버전이 안 박힌 채로 배포될 수 있었다.)
// Kadeora Service Worker v3 — Network First (s200 — stale chunk 근본 fix)
const CACHE_VERSION = '__CACHE_VERSION__';
const CACHE_NAME = 'kadeora-v' + CACHE_VERSION;
const OFFLINE_FALLBACK = '/offline.html';
const PRECACHE = ['/offline.html', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('kadeora-') && k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => clients.claim())
  );
});

// Push / notificationclick / pushsubscriptionchange 핸들러는 그대로 유지
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
    e.waitUntil(self.registration.showNotification('카더라', { body: '새 알림이 있습니다', icon: '/icons/icon-192.png' }));
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'close') return;
  if ('clearAppBadge' in navigator) navigator.clearAppBadge();
  const url = e.notification.data?.url || '/';
  const log_id = e.notification.data?.log_id;
  e.waitUntil(Promise.all([
    log_id
      ? fetch('/api/push/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ log_id }) }).catch(() => {})
      : Promise.resolve(),
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (new URL(c.url).pathname === new URL(url, self.location.origin).pathname && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    }),
  ]));
});

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

// 핵심 fix: 모든 GET 요청 Network First (stale chunk 근본 차단)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // API 요청은 sw 우회
  if (url.pathname.startsWith('/api/')) return;

  // 외부 origin도 우회 (CDN, kakao SDK 등)
  if (url.origin !== self.location.origin) return;

  // Network First — 항상 fresh 자원 우선
  e.respondWith(
    fetch(e.request).then(res => res).catch(() =>
      // 네트워크 실패 시 캐시 (offline 대응) → 그것도 없으면 offline.html
      caches.match(e.request).then(cached =>
        cached || (e.request.mode === 'navigate' ? caches.match(OFFLINE_FALLBACK) : new Response('', { status: 504 }))
      )
    )
  );
});
