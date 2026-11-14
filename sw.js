/* Service worker: lưu sẵn giao diện để ứng dụng mở ngay, kể cả khi mạng yếu.
   Dữ liệu (gọi tới script.google.com) KHÔNG đi qua đây – luôn lấy mới từ máy chủ.
   Mỗi lần sửa index.html/config.js: tăng số phiên bản dưới đây để máy người dùng nhận bản mới. */
const PHIEN_BAN = 'qlct-v2';
const FILES = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(PHIEN_BAN).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== PHIEN_BAN; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
/* Giao diện: trả bản đã lưu ngay, đồng thời tải bản mới về để lần mở sau dùng (stale-while-revalidate). */
self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(PHIEN_BAN).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      const net = fetch(req).then(function (res) { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
