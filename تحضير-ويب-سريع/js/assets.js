/* ═══ قائمة ملفات التطبيق ═══
   مصدر واحد تعتمد عليه ثلاثة أشياء :
     • js/loader.js        يحمّل ملفات المنطق بالترتيب.
     • build/build-html.cjs يكتب وسوم <link> في index.html.
     • sw.js               يخزّنها للعمل بلا إنترنت.
   إضافة كبسولة جديدة تبدأ من هنا ولا شيء غيره. */

(function (root) {
  const STYLES = [
    'tokens',      // الرموز التصميمية : الألوان والمقاسات والمسافات
    'base',        // التصفير والخطّ والأزرار والحقول
    'shell',       // الشريط العلوي والتنقّل واللوحة المنسدلة
    'views',       // الرئيسية والدفتر والمكتبة والإعدادات
    'paper',       // ورقة A4 وأقسامها
    'content',     // تنسيق المحتوى وورقة العمل والنموذج الفارغ
    'images',      // الصور : التحديد والشريط والمقابض والاقتصاص
    'studio',      // استوديو الكتاب
    'responsive',  // التجاوب : هاتف ← تاب ← حاسوب
    'print'        // الطباعة ـ آخر الملفات ليغلب ما قبله
  ];

  /* الترتيب مهمّ : البيانات ثم القاعدة ثم ما يبني عليها ، والإقلاع آخراً. */
  const SCRIPTS = [
    'data/curriculum8', 'data/curriculum9', 'data/bookmap', 'data/gallery',
    'core/db', 'core/utils', 'core/rich', 'core/state',
    'data/plan', 'data/schedule',
    'figs/image-fx', 'figs/figs-view', 'figs/figs-bar', 'figs/figs-wire',
    'inline/inline-model', 'inline/inline-insert', 'inline/inline-ui',
    'inline/inline-crop', 'inline/inline-wire',
    'sheet/sheet-head', 'sheet/sheet-body', 'sheet/blank',
    'editor/viewmode', 'editor/flow', 'editor/fit', 'editor/editor', 'editor/print',
    'studio/studio-shell', 'studio/studio-gallery', 'studio/studio-pdf',
    'studio/studio-capture', 'studio/studio-wire', 'studio/studio-manage',
    'views/views', 'views/library', 'views/settings',
    'app/lock', 'app/sync', 'app/morepanel',
    'app/wire-editor', 'app/wire-settings', 'app/boot'
  ];

  const API = {
    VERSION: '38',
    STYLES, SCRIPTS,
    cssPaths: () => STYLES.map(f => `css/${f}.css`),
    jsPaths: () => SCRIPTS.map(f => `js/${f}.js`)
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.APP_ASSETS = API;
})(typeof self !== 'undefined' ? self : this);
