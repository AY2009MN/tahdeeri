/* خدمة العمل بلا إنترنت — تخزّن ملفات التطبيق محلياً
   الملفات الأساسية تُخزَّن عند التثبيت ، وبقية الملفات (صور الأمثلة ، خطوط PDF) تُخزَّن عند أول طلب. */
const CACHE = 'daftar-v20';
const ASSETS = ['./','./index.html','./css/style.css','./js/db.js','./js/app.js','./js/figs.js','./js/inline.js',
  './js/books.js','./js/bookmap.js','./js/curriculum8.js','./js/curriculum9.js',
  './vendor/pdf.mjs','./vendor/pdf.worker.mjs','./manifest.webmanifest','./icons/logo.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* الشبكة أولاً لملفات التطبيق (فتظهر التحديثات فوراً) ، والذاكرة عند انقطاع الإنترنت */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).pathname.includes('/__')) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
