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

/* ═══ هدف الإدراج وتنفيذه ═══
   الهدف إمّا «موضع إدراج جاهز» نُقر عليه ، أو موضع المؤشّر داخل أحد الصناديق.
   يُتذكَّر الموضع حتى بعد فتح الاستوديو ، فتعود اللقطة إلى مكانها الصحيح. */

document.addEventListener('selectionchange', () => {
  const sel = document.getSelection();
  if (!sel || !sel.rangeCount) return;
  const n = sel.anchorNode;
  const el = n && (n.nodeType === 1 ? n : n.parentElement);
  const box = el && el.closest('#paper .sectbox[contenteditable]');
  if (box) { INL.range = sel.getRangeAt(0).cloneRange(); INL.box = box; INL.slot = null; }
});

/** هل يوجد هدف إدراج صالح في الورقة الحالية؟ */
const inlTarget = () =>
  (INL.slot && document.contains(INL.slot)) || (INL.box && document.contains(INL.box));

function inlTargetName() {
  if (INL.slot && document.contains(INL.slot)) return `مكان «${INL.slot.dataset.label}»`;
  if (!INL.box || !document.contains(INL.box)) return '';
  // عنوان القسم بلا أزرار ضبط الأسطر التي تسكن داخله
  const ttl = INL.box.closest('.sect')?.querySelector('.secttl')?.cloneNode(true);
  ttl?.querySelector('.hctl')?.remove();
  return `موضع المؤشّر في «${(ttl?.textContent || '').trim()}»`;
}

/** يجعل صندوقاً بعينه هدف الإدراج (يُستعمل من قائمة الاستوديو) */
function inlSetTarget(field) {
  const box = $(`#paper .sectbox[data-f="${field}"]`);
  if (!box) return false;
  INL.box = box; INL.slot = null;
  const r = document.createRange();
  r.selectNodeContents(box); r.collapse(false);
  INL.range = r;
  return true;
}

/** يجعل القسم الواقع تحت نقطة الشاشة هدفَ الإدراج ، ويضع المؤشّر عندها.
    يُستعمل مع السحب والإفلات : الصورة تنزل حيث أفلتها المعلّم لا في قسمٍ ثابت. */
function inlTargetAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  const box = el && el.closest('#paper .sectbox[data-f]');
  if (!box || !inlSetTarget(box.dataset.f)) return false;
  let caret = null;
  if (document.caretRangeFromPoint) caret = document.caretRangeFromPoint(x, y);
  else if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    if (p) { caret = document.createRange(); caret.setStart(p.offsetNode, p.offset); caret.collapse(true); }
  }
  if (caret && box.contains(caret.startContainer)) INL.range = caret;
  return true;
}

/** العرض المناسب للصورة بحسب نسبتها ـ الطويلة أضيق لتبقى الورقة متّسقة */
function inlWidthFor(ratio) {
  return ratio > 0.9 ? 55 : ratio > 0.5 ? 75 : 92;
}

/** يضع صفّ الصورة في مكان «موضع الإدراج» ويحوّله إلى عنوان */
function placeAtSlot(row) {
  const box = INL.slot.closest('.sectbox');
  const label = document.createElement('b');
  label.className = 'inllbl';
  label.textContent = INL.slot.dataset.label;
  const line = INL.slot.closest('.sectbox > div') || INL.slot;
  INL.slot.replaceWith(label);
  line.after(row);
  INL.slot = null;
  return box;
}

/** يضع صفّ الصورة عند مؤشّر الكتابة */
function placeAtCursor(row) {
  const box = INL.box;
  let line = INL.range ? INL.range.startContainer : null;
  while (line && line.parentNode !== box) line = line.parentNode;
  if (line) line.after(row); else box.appendChild(row);
  const r = document.createRange();
  r.setStartAfter(row); r.collapse(true);
  INL.range = r;
  return box;
}

/** إدراج صورة في الهدف المحفوظ. يعيد false إن لم يوجد هدف. */
async function insertInline(dataUrl, { w } = {}) {
  if (!inlTarget()) return false;
  const id = await putAsset(dataUrl);
  const probe = await loadImage(dataUrl).catch(() => null);
  const ratio = probe ? probe.naturalHeight / probe.naturalWidth : 0.6;

  const row = document.createElement('div');
  row.className = 'inlrow';
  row.innerHTML = inlSpan({ asset: id, w: w || inlWidthFor(ratio) });

  const box = (INL.slot && document.contains(INL.slot)) ? placeAtSlot(row) : placeAtCursor(row);
  await hydrateAssets(row);
  box.dispatchEvent(new Event('input', { bubbles: true }));
  setTimeout(fitSheets, 60);
  row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return true;
}

/** يحفظ التعديل على صورة ويعيد فحص الامتلاء */
function inlSave(el) {
  const box = el && el.closest('.sectbox');
  if (box) box.dispatchEvent(new Event('input', { bubbles: true }));
  setTimeout(fitSheets, 30);
}

/* ═══ الصورة المحدَّدة : الشريط ، المقابض ، الوضع الحرّ ═══ */

const INL_CORNERS = ['tl', 'tr', 'bl', 'br'];

const ib = (act, label, title, on) =>
  `<button data-ia="${act}" title="${title}" aria-label="${title}"${on ? ' class="on"' : ''}>${label}</button>`;

function inlBarHTML(sp) {
  const w = +sp.dataset.w || 90;
  const free = sp.classList.contains('free');
  const al = c => sp.classList.contains('al-' + c);
  return ib('w:-5', '−', 'تصغير') + `<span>${ar(w)}٪</span>` + ib('w:5', '+', 'تكبير') + '<i></i>'
    + ib('al:r', '⇥', 'يمين', al('r')) + ib('al:c', '≡', 'وسط', al('c')) + ib('al:l', '⇤', 'يسار', al('l'))
    + '<i></i>'
    + ib('half', '◫', 'نصف العرض ـ لوضع صورتين متجاورتين')
    + ib('crop', '✂', 'اقتصاص جزء من الصورة')
    + ib('clean', '▨', 'تفريغ الخلفية وقصّ الحواف') + '<i></i>'
    + ib('free', '✥', 'تحريك حرّ فوق باقي العناصر', free)
    + (free ? ib('z:1', '⤒', 'إلى الأمام') + ib('z:-1', '⤓', 'إلى الخلف') : '')
    + '<i></i>'
    + ib('up', '▲', 'نقل سطراً للأعلى') + ib('down', '▼', 'نقل سطراً للأسفل')
    + ib('del', '🗑', 'حذف');
}

function inlDeselect() {
  $$('.inlbar,.inlh').forEach(x => x.remove());
  $$('.inl.sel').forEach(x => x.classList.remove('sel'));
  INL.sel = null;
}

function inlSelect(sp) {
  inlDeselect();
  INL.sel = sp;
  sp.classList.add('sel');
  const bar = document.createElement('div');
  bar.className = 'inlbar no-print';
  bar.innerHTML = inlBarHTML(sp);
  sp.appendChild(bar);
  for (const c of INL_CORNERS) {
    const h = document.createElement('i');
    h.className = 'inlh no-print h-' + c;
    h.dataset.corner = c;
    h.title = 'اسحب لتغيير الحجم';
    sp.appendChild(h);
  }
}

/** الوضع الحرّ : الصورة تُنتزع من مجرى النصّ فتطفو فوقه وتتراكب بالطبقات */
function inlSetFree(sp, on) {
  const wrap = sp.closest('.sectwrap');
  if (on && wrap) {
    const r = sp.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    sp.classList.add('free');
    sp.dataset.x = Math.round(wr.right - r.right);      // المسافة من الحافة اليمنى
    sp.dataset.y = Math.round(r.top - wr.top);
    sp.dataset.z = sp.dataset.z || 10;
  } else {
    sp.classList.remove('free');
    delete sp.dataset.x; delete sp.dataset.y; delete sp.dataset.z;
  }
  inlApplyFree(sp);
}

function inlApplyFree(sp) {
  if (sp.classList.contains('free')) {
    sp.style.setProperty('--ix', (sp.dataset.x || 0) + 'px');
    sp.style.setProperty('--iy', (sp.dataset.y || 0) + 'px');
    sp.style.setProperty('--iz', sp.dataset.z || 10);
  } else {
    ['--ix', '--iy', '--iz'].forEach(v => sp.style.removeProperty(v));
  }
}

/** يعيد تطبيق الوضع الحرّ بعد إعادة رسم الورقة (القيم محفوظة في data-*) */
function inlRestoreFree(root) {
  $$('.inl.free', root || document).forEach(inlApplyFree);
}

/** حذف صورة مع تنظيف صفّها الفارغ */
function inlRemove(sp) {
  const row = sp.parentElement;
  /* الصندوق يُمسَك قبل النزع : حذف آخر صورة يُزيل صفّها ، فكان الحفظ يذهب
     إلى أوّل صندوق في الورقة لا إلى الذي تغيّر ـ فتعود الصورة عند العودة. */
  const box = sp.closest('.sectbox');
  sp.remove();
  if (row.classList.contains('inlrow') && !row.children.length) row.remove();
  INL.sel = null;
  inlSave(box || row);
}

/** تنفيذ أمر من شريط الصورة ـ يعيد true إن اكتفى بنفسه فلا يُعاد التحديد */
async function inlAction(a, v, sp, btn) {
  const setW = w => { sp.dataset.w = w; sp.style.width = w + '%'; };
  if (a === 'w') setW(Math.max(10, Math.min(100, (+sp.dataset.w || 90) + (+v))));
  if (a === 'al') { sp.classList.remove('al-r', 'al-c', 'al-l'); sp.classList.add('al-' + v); }
  if (a === 'half') setW(+sp.dataset.w > 50 ? 48 : 90);
  if (a === 'free') inlSetFree(sp, !sp.classList.contains('free'));
  if (a === 'z') { sp.dataset.z = Math.max(1, Math.min(99, (+sp.dataset.z || 10) + (+v))); inlApplyFree(sp); }
  if (a === 'crop') { inlCrop(sp); return true; }
  if (a === 'del') { inlRemove(sp); return true; }
  if (a === 'up' || a === 'down') {
    const row = sp.parentElement;
    const sib = a === 'up' ? row.previousElementSibling : row.nextElementSibling;
    if (sib) a === 'up' ? sib.before(row) : sib.after(row);
  }
  if (a === 'clean') {
    const img = sp.querySelector('img');
    btn.textContent = '…';
    try {
      const out = await cleanShot(img.src);
      if (img.dataset.asset) {
        ASSETS[img.dataset.asset] = out;
        await DB.put('assets', { id: img.dataset.asset, data: out });
      }
      img.src = out;
    } catch { alert('تعذّر تفريغ خلفية هذه الصورة.'); }
  }
  return false;
}
