/* ═══ قائمة ملفات التطبيق ═══
   مصدر واحد تعتمد عليه ثلاثة أشياء :
     • js/loader.js        يحمّل ملفات المنطق بالترتيب.
     • build/build-html.cjs يكتب وسوم <link> في index.html.
     • sw.js               يخزّنها للعمل بلا إنترنت.
   إضافة كبسولة جديدة تبدأ من هنا ولا شيء غيره. */

(function (root) {
  const STYLES = [
    'base',        // الرموز التصميمية ، التصفير والخطّ والأزرار ، الشريط والتنقّل
    'paper',       // العروض ، وورقة A4 وأقسامها ، وتنسيق المحتوى وورقة العمل
    'images',      // الصور : التحديد والشريط والمقابض والاقتصاص ، واستوديو الكتاب
    'responsive'   // التجاوب هاتف ← تاب ← حاسوب ، ثمّ الطباعة ـ آخرها ليغلب ما قبله
  ];

  /* الترتيب مهمّ : البيانات ثم القاعدة ثم ما يبني عليها ، والإقلاع آخراً. */
  const SCRIPTS = [
    'data/curriculum8', 'data/curriculum9', 'data/bookmap', 'data/gallery',
    'core/base', 'core/state', 'data/plan', 'data/schedule',
    'figs/image-fx', 'figs/figs',
    'inline/inline', 'inline/inline-edit',
    'sheet/sheet', 'editor/layout', 'editor/editor',
    'studio/studio-shell', 'studio/studio-pdf', 'studio/studio-tools',
    'views/views', 'app/lock', 'app/cloud', 'app/wire', 'app/boot'
  ];

  const API = {
    VERSION: '46',
    STYLES, SCRIPTS,
    cssPaths: () => STYLES.map(f => `css/${f}.css`),
    jsPaths: () => SCRIPTS.map(f => `js/${f}.js`)
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.APP_ASSETS = API;
})(typeof self !== 'undefined' ? self : this);
