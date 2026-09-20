/* ═══ محمّل كبسولات المنطق ═══
   يُدرج ملفات js/assets.js بالترتيب. الوسوم المُنشأة ديناميكياً تُنفَّذ بترتيب
   إدراجها ما دام async = false ، فيبقى ترتيب الاعتماد بين الكبسولات محفوظاً
   كما لو كُتبت وسوم <script> واحداً تلو الآخر في الصفحة. */
(function () {
  const A = self.APP_ASSETS;
  if (!A) {
    document.body.insertAdjacentHTML('afterbegin',
      '<div class="banner err">تعذّر تحميل قائمة ملفات التطبيق (js/assets.js).</div>');
    return;
  }
  for (const src of A.jsPaths()) {
    const s = document.createElement('script');
    s.src = src + '?v=' + A.VERSION;
    s.async = false;                  // يحفظ ترتيب التنفيذ
    s.onerror = () => console.error('تعذّر تحميل', src);
    document.head.appendChild(s);
  }
})();
