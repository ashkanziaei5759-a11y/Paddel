/* --------------------------------------------------------------------------
 * PERSIAN PADEL — Service Worker
 * راهبرد: Network-first برای صفحات و API، Cache-first برای دارایی‌های ثابت.
 * ------------------------------------------------------------------------ */

const VERSION = 'pp-v3';
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

/* manifest دیگر فایل ثابت نیست — از پایگاه داده ساخته می‌شود و آیکونش از پنل
   عوض می‌شود، پس نباید در کش نصب بیفتد وگرنه آیکون قدیمی می‌ماند */
const PRECACHE = ['/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // مسیرهای API و پرداخت هرگز کش نمی‌شوند — داده‌ی مالی باید تازه باشد
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/payment/')) return;

  // دارایی‌های ثابت: ابتدا کش
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  // ناوبری صفحات: ابتدا شبکه، در نبود اینترنت از کش یا صفحه‌ی آفلاین
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/offline')),
        ),
    );
  }
});

/* آماده برای Push Notification در آینده */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = { title: 'پرشین پدل', body: '', url: '/home' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      dir: 'rtl',
      lang: 'fa',
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/home';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(target) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});

/* ---------------- اعلان روی گوشی (Web Push) ---------------- */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'باشگاه پدل';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    image: data.image || undefined,
    dir: 'rtl',
    lang: 'fa',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/notifications' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* لمس اعلان: اگر اپ باز است همان پنجره به صفحه‌ی مقصد می‌رود، وگرنه باز می‌شود */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/notifications', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then((c) => (c && 'navigate' in c ? c.navigate(target) : undefined));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

/* مرورگر گاهی اشتراک را عوض می‌کند؛ اشتراک تازه را دوباره ثبت می‌کنیم */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    fetch('/api/push')
      .then((r) => r.json())
      .then((json) =>
        self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: json.data.publicKey,
        }),
      )
      .then((sub) =>
        fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        }),
      )
      .catch(() => undefined),
  );
});
