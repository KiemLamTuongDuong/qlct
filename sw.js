/* Service worker:
   1) Lưu sẵn giao diện để ứng dụng mở ngay, kể cả khi mạng yếu. Dữ liệu (script.google.com) không đi qua đây.
   2) Nhận thông báo đẩy (Firebase Cloud Messaging) khi ứng dụng đang đóng, chạm vào thì mở đúng màn hình.
   Tự cập nhật: sửa index.html/config.js trên GitHub là đủ, app tự phát hiện. Chỉ đổi PHIEN_BAN khi thêm/bớt file trong FILES. */
const PHIEN_BAN = 'qlct-v13';
const BO_BAN_DO = 'qlct-bando';   // gói bản đồ nền (thư mục bando/) – giữ qua các lần cập nhật ứng dụng
const FILES = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  'mau/bb_kiem_tra.docx', 'mau/bb_tiep_nhan.docx', 'mau/phu_luc.xlsx', 'mau/bb_hop_dan.docx', 'bando.js'];   // mẫu biên bản, phụ lục: dùng được khi không có mạng

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
  // cache:'reload' → luôn lấy bản mới nhất từ GitHub, không lấy bản cũ trong bộ nhớ đệm trình duyệt
  e.waitUntil(caches.open(PHIEN_BAN).then(function (c) {
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    const cu = ks.filter(function (k) { return k !== PHIEN_BAN && k !== BO_BAN_DO; });
    return Promise.all(cu.map(function (k) { return caches.delete(k); })).then(function () { return cu.length; });
  }).then(function (n) {
    return self.clients.claim().then(function () { if (n) return baoCapNhat(); });   // thay bản cũ → app tự tải lại
  }));
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
  if (url.searchParams.has('kt')) return;   // app tự kiểm tra bản mới: đi thẳng lên GitHub
  if (url.pathname.indexOf('/bando/') >= 0) { e.respondWith(banDo(req, url)); return; }
  const key = url.pathname === new URL(self.registration.scope).pathname ? './' : req;
  const cacheP = caches.open(PHIEN_BAN);
  const hitP = cacheP.then(function (c) { return c.match(key, { ignoreSearch: true }); });
  // tách sẵn 2 bản của phản hồi mạng: một để hiển thị, một để lưu/so sánh
  const netP = fetch(req, { cache: 'no-cache' }).then(function (r) { return { r: r, c: r.ok ? r.clone() : null }; });
  // việc kiểm tra bản mới phải đăng ký NGAY (waitUntil đồng bộ), nếu không trình duyệt có thể dừng nó giữa chừng
  e.waitUntil(Promise.all([cacheP, hitP, netP]).then(function (a) {
    const c = a[0], hit = a[1], moi = a[2].c;
    if (!moi) return;
    if (hit && THEO_DOI.test(url.pathname)) {
      return Promise.all([moi.clone().text(), hit.clone().text()]).then(function (t) {
        return c.put(key, moi).then(function () { if (t[0] !== t[1]) return baoCapNhat(); });
      });
    }
    return c.put(key, moi);
  }).catch(function () {}));
  e.respondWith(hitP.then(function (hit) {
    return hit || netP.then(function (x) { return x.r; }).catch(function () { return Response.error(); });
  }));
});

/* Gói bản đồ nền: ds.json lấy mạng trước (để biết gói mới), gói <xã>.json lấy bộ nhớ trước (nặng vài MB).
   ?moi=... → bắt buộc tải lại từ mạng và lưu đè. Lưu theo địa chỉ không kèm ?moi. */
function banDo(req, url) {
  const sach = url.origin + url.pathname, moi = url.searchParams.has('moi');
  return caches.open(BO_BAN_DO).then(function (c) {
    const mang = function () {
      return fetch(sach, { cache: 'no-cache' }).then(function (r) { if (r.ok) c.put(sach, r.clone()); return r; });
    };
    if (moi || /\/ds\.json$/.test(url.pathname)) {
      return mang().catch(function () { return c.match(sach).then(function (h) { return h || Response.error(); }); });
    }
    return c.match(sach).then(function (h) { return h || mang(); });
  });
}
