/* ═══ الصور داخل النصّ : النموذج والتخزين ═══
   span.inl  صورة تُدرج في موضع المؤشّر نفسه وتُحفظ ضمن نصّ الحقل.
   span.slot موضع إدراج جاهز ، النقر عليه يفتح صفحات الدرس واللقطة تحلّ محلّه.
   الصور تُخزَّن في مخزن assets ويُشار إليها بمعرّف (data-asset) ، فلا يتضخّم
   نصّ التحضير وتنتقل كاملة مع ملف النقل. */

const INL = { range: null, box: null, slot: null, sel: null };
const ASSETS = {};                                  // معرّف ← data URL (ذاكرة مؤقتة)

const newAssetId = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** يحفظ صورة في المخزن ويعيد معرّفها */
async function putAsset(dataUrl) {
  const id = newAssetId();
  await DB.put('assets', { id, data: dataUrl, added: todayISO() });
  ASSETS[id] = dataUrl;
  return id;
}

function inlSpan({ src, asset, w = 90, al = 'c' }) {
  const img = asset
    ? `<img data-asset="${esc(asset)}" alt="" decoding="async">`
    : `<img src="${esc(src)}" alt="" decoding="async">`;
  return `<span class="inl al-${al}" contenteditable="false" data-w="${w}" style="width:${w}%">${img}</span>`;
}

/* رموز الكتابة المختصرة داخل ملفات المنهج :
     [[img:img/x.png|48]]      صورة بعرض ٤٨٪ (صورتان في سطر واحد تصطفّان)
     [[slot:مثال (١) ص(٢١)]]   موضع إدراج
     {{٧ د}}                   زمن البند                                   */
function inlTokens(line) {
  const imgs = [...line.matchAll(/\[\[img:([^|\]]+)(?:\|(\d+))?(?:\|([rcl]))?\]\]/g)];
  if (!imgs.length || line.replace(/\[\[img:[^\]]+\]\]/g, '').trim()) return null;
  const each = imgs.length > 1 ? Math.floor(96 / imgs.length) : 90;
  return `<div class="inlrow">${imgs.map(m => inlSpan({
    src: m[1].startsWith('asset:') ? null : m[1],
    asset: m[1].startsWith('asset:') ? m[1].slice(6) : null,
    w: +(m[2] || each), al: m[3] || 'c' })).join('')}</div>`;
}

function inlInline(html) {
  return html
    .replace(/\[\[slot:([^\]]+)\]\]/g, (m, t) =>
      `<span class="slot" contenteditable="false" data-label="${esc(t)}"
         title="انقر لإدراج صورة من الكتاب">＋ ${esc(t)}</span>`)
    .replace(/\{\{([^}]+)\}\}/g, '<span class="tm">$1</span>');
}

/** تنظيف HTML قبل الحفظ : تُنزع الأشرطة والمقابض ويُثبَّت العرض المختار */
function cleanHTML(el) {
  const c = el.cloneNode(true);
  $$('.inlbar,.inlh', c).forEach(x => x.remove());
  $$('.inl.sel', c).forEach(x => x.classList.remove('sel'));
  $$('img[data-asset]', c).forEach(x => x.removeAttribute('src'));
  $$('.inl[data-w]', c).forEach(x => { x.style.width = x.dataset.w + '%'; });
  return c.innerHTML;
}

/** تحميل الصور المخزَّنة إلى وسوم img التي تحمل معرّفاً */
async function hydrateAssets(root) {
  for (const img of $$('img[data-asset]:not([src])', root || document)) {
    const id = img.dataset.asset;
    if (!ASSETS[id]) { const r = await DB.get('assets', id); if (r) ASSETS[id] = r.data; }
    if (ASSETS[id]) img.src = ASSETS[id];
  }
}

/** كل صور النصّ في الورقة الحالية ـ تُستعمل في لوحة إدارة الصور */
const inlAll = () => $$('#paper .inl');
