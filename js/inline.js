/* =====================================================================
   الصور داخل النصّ + مواضع الإدراج
   ــ span.inl  : صورة تُدرج في موضع المؤشّر نفسه داخل المقدمة أو العرض،
                  وتُحفظ ضمن نصّ الحقل. تُحدَّد بالنقر فيظهر شريطها:
                  تصغير/تكبير · يمين/وسط/يسار · تفريغ الخلفية · حذف، ومقبض سحب للحجم.
   ــ span.slot : موضع إدراج جاهز (مثل «مثال (١) ص٢١») ـ النقر عليه يفتح صفحات
                  الدرس، واللقطة التالية تحلّ محلّه تلقائياً.
   ــ الصور الملتقطة تُخزَّن في مخزن assets وتُشار إليها بمعرّف (data-asset)
      فلا يتضخّم نصّ التحضير، وتنتقل كاملة مع ملف النقل.
   ===================================================================== */

const INL = { range: null, box: null, slot: null, sel: null };
const ASSETS = {};                                   // معرّف ← data URL (ذاكرة مؤقتة)

/* ────────── بناء العناصر ────────── */
function inlSpan({ src, asset, w = 90, al = 'c' }) {
  const img = asset ? `<img data-asset="${esc(asset)}" alt="" decoding="async">` : `<img src="${esc(src)}" alt="" decoding="async">`;
  return `<span class="inl al-${al}" contenteditable="false" data-w="${w}" style="width:${w}%">${img}</span>`;
}

/* رموز الكتابة المختصرة داخل ملفات المنهج:
     [[img:img/x.png|48]]      صورة بعرض ٤٨٪ (صورتان في سطر واحد تصطفّان متجاورتين)
     [[slot:مثال (١) ص(٢١)]]   موضع إدراج
     {{٧ د}}                   زمن البند                                                   */
function inlTokens(line) {
  const imgs = [...line.matchAll(/\[\[img:([^|\]]+)(?:\|(\d+))?(?:\|([rcl]))?\]\]/g)];
  if (imgs.length && !line.replace(/\[\[img:[^\]]+\]\]/g, '').trim()) {
    return `<div class="inlrow">${imgs.map(m => inlSpan({
      src: m[1].startsWith('asset:') ? null : m[1],
      asset: m[1].startsWith('asset:') ? m[1].slice(6) : null,
      w: +(m[2] || (imgs.length > 1 ? Math.floor(96 / imgs.length) : 90)), al: m[3] || 'c' })).join('')}</div>`;
  }
  return null;
}

function inlInline(html) {
  return html
    .replace(/\[\[slot:([^\]]+)\]\]/g, (m, t) =>
      `<span class="slot" contenteditable="false" data-label="${t}" title="انقر لإدراج لقطة من صفحات الدرس">＋ ${t}</span>`)
    .replace(/\{\{([^}]+)\}\}/g, '<span class="tm">$1</span>');
}

/* ────────── تنظيف HTML قبل الحفظ ────────── */
function cleanHTML(el) {
  const c = el.cloneNode(true);
  c.querySelectorAll('.inlbar,.inlh').forEach(x => x.remove());
  c.querySelectorAll('.inl.sel').forEach(x => x.classList.remove('sel'));
  c.querySelectorAll('img[data-asset]').forEach(x => x.removeAttribute('src'));
  c.querySelectorAll('.inl[data-w]').forEach(x => { x.style.width = x.dataset.w + '%'; });   // يُحفظ العرض المختار لا المصغَّر
  return c.innerHTML;
}

/* ────────── تحميل الصور المخزّنة ────────── */
async function hydrateAssets(root) {
  for (const img of (root || document).querySelectorAll('img[data-asset]:not([src])')) {
    const id = img.dataset.asset;
    if (!ASSETS[id]) { const r = await DB.get('assets', id); if (r) ASSETS[id] = r.data; }
    if (ASSETS[id]) img.src = ASSETS[id];
  }
}

/* ────────── معالجة اللقطة: تفريغ الخلفية + قصّ الحواف + ضبط الحجم ────────── */
function trimImage(src, { pad = 6, maxW = 1400 } = {}) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      let t = c.height, l = c.width, r = -1, b = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        const ink = d[i + 3] > 24 && !(d[i] > 246 && d[i + 1] > 246 && d[i + 2] > 246);
        if (ink) { if (y < t) t = y; if (y > b) b = y; if (x < l) l = x; if (x > r) r = x; }
      }
      if (r < l || b < t) return res(src);
      const w = r - l + 1, h = b - t + 1;
      const k = Math.min(1, maxW / (w + pad * 2));
      const o = document.createElement('canvas');
      o.width = Math.round((w + pad * 2) * k); o.height = Math.round((h + pad * 2) * k);
      const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high';
      ox.drawImage(c, l, t, w, h, pad * k, pad * k, w * k, h * k);
      res(o.toDataURL('image/png'));
    };
    img.onerror = rej; img.src = src;
  });
}

/* ────────── تذكّر موضع المؤشّر ────────── */
document.addEventListener('selectionchange', () => {
  const s = document.getSelection(); if (!s || !s.rangeCount) return;
  const n = s.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement);
  const box = el && el.closest('#paper .sectbox[contenteditable]');
  if (box) { INL.range = s.getRangeAt(0).cloneRange(); INL.box = box; INL.slot = null; }
});

/** هل يوجد هدف إدراج صالح في الورقة الحالية؟ */
const inlTarget = () =>
  (INL.slot && document.contains(INL.slot)) || (INL.box && document.contains(INL.box));

function inlTargetName() {
  if (INL.slot && document.contains(INL.slot)) return `مكان «${INL.slot.dataset.label}»`;
  if (INL.box && document.contains(INL.box)) {
    const t = INL.box.closest('.sect')?.querySelector('.secttl')?.textContent || '';
    return `موضع المؤشّر في «${t.trim()}»`;
  }
  return '';
}

/** إدراج صورة في الهدف المحفوظ. يعيد false إن لم يوجد هدف. */
async function insertInline(dataUrl, { w } = {}) {
  if (!inlTarget()) return false;
  const id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await DB.put('assets', { id, data: dataUrl, added: iso(new Date()) });
  ASSETS[id] = dataUrl;

  const probe = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = dataUrl; });
  const ratio = probe.naturalHeight / probe.naturalWidth;
  const width = w || (ratio > 0.9 ? 55 : ratio > 0.5 ? 75 : 92);   // الصور الطويلة أضيق لتبقى متناسقة

  const row = document.createElement('div');
  row.className = 'inlrow';
  row.innerHTML = inlSpan({ asset: id, w: width });

  let box;
  if (INL.slot && document.contains(INL.slot)) {
    box = INL.slot.closest('.sectbox');
    const label = document.createElement('b');
    label.className = 'inllbl'; label.textContent = INL.slot.dataset.label;
    const line = INL.slot.closest('.sectbox > div') || INL.slot;
    INL.slot.replaceWith(label);
    line.after(row);
    INL.slot = null;
  } else {
    box = INL.box;
    let line = INL.range ? INL.range.startContainer : null;
    while (line && line.parentNode !== box) line = line.parentNode;
    if (line) line.after(row); else box.appendChild(row);
    const r = document.createRange(); r.setStartAfter(row); r.collapse(true);
    INL.range = r;
  }
  await hydrateAssets(row);
  box.dispatchEvent(new Event('input', { bubbles: true }));
  setTimeout(fitSheets, 60);
  row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return true;
}

/* ────────── التفاعل داخل الورقة ────────── */
function inlSave(el) {
  const box = el.closest('.sectbox');
  if (box) box.dispatchEvent(new Event('input', { bubbles: true }));
  setTimeout(fitSheets, 30);
}

function inlDeselect() {
  document.querySelectorAll('.inlbar,.inlh').forEach(x => x.remove());
  document.querySelectorAll('.inl.sel').forEach(x => x.classList.remove('sel'));
  INL.sel = null;
}

function inlSelect(sp) {
  inlDeselect();
  INL.sel = sp; sp.classList.add('sel');
  const w = +sp.dataset.w || 90;
  const bar = document.createElement('div');
  bar.className = 'inlbar no-print';
  bar.innerHTML = `
    <button data-ia="w:-5" title="تصغير">−</button><span>${ar(w)}٪</span><button data-ia="w:5" title="تكبير">+</button>
    <i></i>
    <button data-ia="al:r" title="يمين" class="${sp.classList.contains('al-r') ? 'on' : ''}">⇥</button>
    <button data-ia="al:c" title="وسط" class="${sp.classList.contains('al-c') ? 'on' : ''}">≡</button>
    <button data-ia="al:l" title="يسار" class="${sp.classList.contains('al-l') ? 'on' : ''}">⇤</button>
    <i></i>
    <button data-ia="half" title="نصف العرض ـ لوضع صورتين متجاورتين">◫</button>
    <button data-ia="clean" title="تفريغ الخلفية وقصّ الحواف">▨</button>
    <button data-ia="up" title="نقل سطراً للأعلى">▲</button>
    <button data-ia="down" title="نقل سطراً للأسفل">▼</button>
    <button data-ia="del" title="حذف">🗑</button>`;
  sp.appendChild(bar);
  const h = document.createElement('i'); h.className = 'inlh no-print'; h.title = 'اسحب لتغيير الحجم';
  sp.appendChild(h);
}

function wireInline() {
  const paper = document.getElementById('paper');
  if (!paper || paper.dataset.inlwired) return;
  paper.dataset.inlwired = '1';

  paper.addEventListener('click', async e => {
    const slot = e.target.closest('.slot');
    if (slot) {
      e.preventDefault();
      INL.slot = slot; INL.box = slot.closest('.sectbox');
      if (typeof openInsertViewer === 'function') openInsertViewer();
      return;
    }
    const btn = e.target.closest('[data-ia]');
    if (btn && INL.sel) {
      e.preventDefault(); e.stopPropagation();
      const sp = INL.sel, [a, v] = btn.dataset.ia.split(':');
      const row = sp.parentElement;
      if (a === 'w') { const w = Math.max(15, Math.min(100, (+sp.dataset.w || 90) + (+v))); sp.dataset.w = w; sp.style.width = w + '%'; }
      if (a === 'al') { sp.classList.remove('al-r', 'al-c', 'al-l'); sp.classList.add('al-' + v); }
      if (a === 'half') { const w = +sp.dataset.w > 50 ? 48 : 90; sp.dataset.w = w; sp.style.width = w + '%'; }
      if (a === 'clean') {
        const img = sp.querySelector('img'); btn.textContent = '…';
        try {
          const out = await trimImage(await removeWhite(img.src));
          if (img.dataset.asset) { ASSETS[img.dataset.asset] = out; await DB.put('assets', { id: img.dataset.asset, data: out }); }
          img.src = out;
        } catch { alert('تعذّر تفريغ خلفية هذه الصورة.'); }
      }
      if (a === 'up' || a === 'down') {
        const sib = a === 'up' ? row.previousElementSibling : row.nextElementSibling;
        if (sib) a === 'up' ? sib.before(row) : sib.after(row);
      }
      if (a === 'del') { const r = sp.parentElement; sp.remove(); if (r.classList.contains('inlrow') && !r.children.length) r.remove(); INL.sel = null; inlSave(r.isConnected ? r : paper.querySelector('.sectbox')); return; }
      inlSelect(sp); inlSave(sp);
      return;
    }
    const sp = e.target.closest('.inl');
    if (sp) { if (INL.sel !== sp) inlSelect(sp); return; }
    if (!e.target.closest('.inlbar')) inlDeselect();
  });

  /* مقبض الحجم */
  let drag = null;
  paper.addEventListener('pointerdown', e => {
    const h = e.target.closest('.inlh'); if (!h) return;
    e.preventDefault(); e.stopPropagation();
    const sp = h.closest('.inl'), host = sp.closest('.sectbox');
    drag = { sp, x0: e.clientX, w0: +sp.dataset.w || 90, W: host.clientWidth };
    h.setPointerCapture?.(e.pointerId);
  });
  paper.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = drag.x0 - e.clientX;                     // الصفحة من اليمين: السحب يساراً يكبّر
    const w = Math.max(15, Math.min(100, Math.round(drag.w0 + dx / drag.W * 100)));
    drag.sp.dataset.w = w; drag.sp.style.width = w + '%';
    const lbl = drag.sp.querySelector('.inlbar span'); if (lbl) lbl.textContent = ar(w) + '٪';
  });
  paper.addEventListener('pointerup', () => { if (drag) { inlSave(drag.sp); drag = null; } });

  /* مفتاح الحذف على الصورة المحدَّدة */
  document.addEventListener('keydown', e => {
    if (!INL.sel || !document.contains(INL.sel)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault(); const r = INL.sel.parentElement; INL.sel.remove();
      if (r.classList.contains('inlrow') && !r.children.length) r.remove();
      INL.sel = null; inlSave(r.isConnected ? r : paper.querySelector('.sectbox'));
    }
    if (e.key === 'Escape') inlDeselect();
  });
}

/* ────────── الكتابة في أيّ مكان داخل الصندوق ──────────
   صندوق النصّ بارتفاع محتواه ، فالنقر تحت آخر سطر كان يقع على إطار القسم
   فلا يستقبل الكتابة. هنا نحوّل أيّ نقرة داخل القسم إلى مؤشّر كتابة في نهايته. */
function wireBoxClick() {
  const paper = document.getElementById('paper');
  if (!paper || paper.dataset.boxwired) return;
  paper.dataset.boxwired = '1';
  paper.addEventListener('mousedown', e => {
    if (e.target.closest('.inl, .inlbar, .inlh, .slot, .hctl, [contenteditable]')) return;
    const wrap = e.target.closest('.sectwrap, .sect');
    const box = wrap && wrap.querySelector('[contenteditable][data-f]');
    if (!box) return;
    e.preventDefault();
    box.focus();
    const r = document.createRange();
    r.selectNodeContents(box); r.collapse(false);       // المؤشّر بعد آخر حرف
    const s = document.getSelection(); s.removeAllRanges(); s.addRange(r);
    box.scrollIntoView({ block: 'nearest' });
  });
}
