/* Service worker:
   1) Lưu sẵn giao diện để ứng dụng mở ngay, kể cả khi mạng yếu. Dữ liệu (script.google.com) không đi qua đây.
   2) Nhận thông báo đẩy (Firebase Cloud Messaging) khi ứng dụng đang đóng, chạm vào thì mở đúng màn hình.
   Tự cập nhật: sửa index.html/config.js trên GitHub là đủ, app tự phát hiện. Chỉ đổi PHIEN_BAN khi thêm/bớt file trong FILES. */
const PHIEN_BAN = 'qlct-v7';
const FILES = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

// ---- thông báo đẩy: đọc cấu hình Firebase trong config.js (file đó ghi window.CAU_HINH) ----
self.window = self;
try { importScripts('config.js'); } catch (e) { /* chưa có cấu hình */ }
const CF = self.CAU_HINH || {};
if (CF.FIREBASE && CF.FIREBASE.apiKey) {
  try {
    importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');
    firebase.initializeApp(CF.FIREBASE);
    firebase.messaging().onBackgroundMessage(function (p) {
      const d = (p && p.data) || {};
      return self.registration.showNotification(d.title || 'Quản lý công tác', {
        body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', lang: 'vi',
        tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || './' }
      });
    });
  } catch (e) { /* không tải được thư viện (mất mạng lúc cài) – lần sau sẽ thử lại */ }
}
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  const mo = (url.match(/[?&]mo=([a-z]+)/) || [])[1] || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ds) {
    const c = ds.filter(function (x) { return x.url.indexOf(self.registration.scope) === 0; })[0];
    if (c) { c.postMessage({ mo: mo }); return c.focus(); }     // app đang mở: chuyển màn hình
    return self.clients.openWindow(url);
  }));
});

// ---- lưu giao diện ----
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(PHIEN_BAN).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== PHIEN_BAN; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
/* Giao diện: trả bản đã lưu ngay (mở nhanh), đồng thời hỏi lại GitHub xem có bản mới không.
   Nếu index.html / config.js trên GitHub khác bản đang lưu → lưu bản mới và báo cho app biết để tự cập nhật. */
const THEO_DOI = /(\/|index\.html|config\.js)$/;
function baoCapNhat() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ds) {
    ds.forEach(function (c) { c.postMessage({ capNhat: true }); });
  });
}
self.addEventListener('fetch', function (e) {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const key = url.pathname === new URL(self.registration.scope).pathname ? './' : req;
  e.respondWith(caches.open(PHIEN_BAN).then(function (c) {
    return c.match(key, { ignoreSearch: true }).then(function (hit) {
      const net = fetch(req, { cache: 'no-cache' }).then(function (res) {
        if (!res || !res.ok) return res;
        const moi = res.clone();
        e.waitUntil((hit && THEO_DOI.test(url.pathname) ? Promise.all([moi.clone().text(), hit.clone().text()]).then(function (t) {
          return c.put(key, moi).then(function () { if (t[0] !== t[1]) return baoCapNhat(); });
        }) : c.put(key, moi)).catch(function () {}));
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
