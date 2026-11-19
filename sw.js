/* FLIGHT OPS Service Worker
   ・アプリ本体（HTML/CSS/JS/アイコン）はキャッシュ優先でオフラインでも起動
   ・運航データ（boards.json）はネットワーク優先（失敗時はキャッシュ）
   バージョンを上げると古いキャッシュは破棄されます。 */
var VERSION = 'flightops-v1.0.0';
var SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './airports_data.js',
  './airlines_data.js',
  './links_data.js',
  './manifest.json',
  './fonts/jetbrainsmono.woff2',
  './fonts/inter.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './data/boards.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () { });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // 運航データはネットワーク優先（10分ごとに新しくなる）
  if (/boards\.json$/.test(url.pathname) || /raw\.githubusercontent\.com$/.test(url.hostname)) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  if (url.origin !== location.origin) return; // 外部（adsbdb等）はそのまま

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        // 背後で更新
        fetch(req).then(function (res) {
          if (res && res.ok) caches.open(VERSION).then(function (c) { c.put(req, res.clone()); });
        }).catch(function () { });
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok && url.origin === location.origin) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
