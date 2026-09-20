/* ═══ معرض صور الدرس ═══
   كتاب الطالب مقصوص مسبقاً إلى ٥٠٠ صورة مفهرسة بالصف والدرس (js/data/gallery.js).
   يفتح المعرض على صور الدرس الحالي ، ويمكن تصفّح أيّ درس آخر أو البحث بالوصف.
   نقرة واحدة على الصورة تُدرجها في موضع الإدراج المختار ـ بلا قصّ ولا انتظار. */

const GAL = { code: null, q: '' };

const galleryOf = (gid, code) => (window.BOOK_GALLERY?.[gid] || {})[code] || [];

/** كل صور الصف مجموعةً ، حين يبحث المعلّم في الكتاب كلّه */
function gallerySearchAll(gid, q) {
  const book = window.BOOK_GALLERY?.[gid] || {};
  const out = [];
  for (const code of Object.keys(book))
    for (const it of book[code])
      if ((it.t + ' ' + code).includes(q)) out.push({ ...it, code });
  return out;
}

function galleryBar() {
  const s = curSession();
  const codes = Object.keys(window.BOOK_GALLERY?.[grade] || {});
  const cur = GAL.code || (s && s.code);
  const opts = codes.map(c =>
    `<option value="${esc(c)}"${c === cur ? ' selected' : ''}>${esc(c)} (${ar(galleryOf(grade, c).length)})</option>`).join('');
  byId('stBarGallery').innerHTML =
    `<label>الدرس <select id="stGalLesson">${opts || '<option value="">—</option>'}</select></label>
     <input id="stGalSearch" class="grow" type="search" placeholder="ابحث : مثال ، قاعدة ، جدول…"
            value="${esc(GAL.q)}" aria-label="بحث في صور الكتاب">
     <span class="meta" id="stGalCount"></span>`;
}

/** صور الوحدة كلّها ـ بديل معقول حين لا يكون للدرس صور مفهرسة */
function galleryOfUnit(gid, code) {
  const unit = String(code).split(' ')[0];
  const book = window.BOOK_GALLERY?.[gid] || {};
  const out = [];
  for (const c of Object.keys(book))
    if (c.startsWith(unit)) for (const it of book[c]) out.push({ ...it, code: c });
  return out;
}

/** ما يُعرض الآن ، مع سبب اختياره */
function galleryItems() {
  if (GAL.q) return { items: gallerySearchAll(grade, GAL.q.trim()), note: '' };
  const own = galleryOf(grade, GAL.code).map(x => ({ ...x, code: GAL.code }));
  if (own.length) return { items: own, note: '' };
  const unit = galleryOfUnit(grade, GAL.code);
  return unit.length
    ? { items: unit, note: `لا صور لدرس ${GAL.code} وحده ـ هذه صور وحدته كلّها.` }
    : { items: [], note: '' };
}

function renderGallery() {
  const s = curSession();
  if (!s) return;
  if (GAL.code === null) GAL.code = s.code;
  galleryBar();

  const { items, note } = galleryItems();
  setText('stGalCount', `${ar(items.length)} صورة`);
  byId('stGrid').innerHTML = items.length
    ? (note ? `<p class="st-empty" style="grid-column:1/-1;padding:0 0 8px">${esc(note)}</p>` : '')
      + items.map(it => `
        <button class="st-cell" data-gal="${esc(it.f)}" title="${esc(it.t)} ـ ${esc(it.code)}">
          <img src="img/${esc(it.f)}" alt="${esc(it.t)}" loading="lazy" decoding="async">
          <span>${esc(it.t)}</span>
        </button>`).join('')
    : `<p class="st-empty">لا صور مفهرسة لهذا الدرس بعد.<br>
        اقصص ما تحتاجه من كتاب الطالب نفسه ، أو ابحث في صور الكتاب كلّها بالأعلى.
        <br><button class="btn primary" data-sttab="pdf" style="margin-top:14px">
          فتح صفحات الكتاب للقصّ</button></p>`;
}

/** يحوّل ملفاً من مجلد الصور إلى data URL ليُحفظ مع التحضير وينتقل مع ملف النقل */
async function galleryDataUrl(file) {
  const res = await fetch('img/' + file);
  const blob = await res.blob();
  return new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
}

function wireGallery(v) {
  v.addEventListener('change', e => {
    if (e.target.id !== 'stGalLesson') return;
    GAL.code = e.target.value; GAL.q = '';
    renderGallery();
  });

  v.addEventListener('input', debounce(e => {
    if (e.target.id !== 'stGalSearch') return;
    GAL.q = e.target.value;
    renderGallery();
    byId('stGalSearch')?.focus();
  }, 220));

  v.addEventListener('click', async e => {
    const cell = e.target.closest('[data-gal]');
    if (!cell) return;
    cell.style.opacity = '.4';
    try { await studioInsert(await galleryDataUrl(cell.dataset.gal)); }
    catch { alert('تعذّر تحميل هذه الصورة.'); }
    finally { cell.style.opacity = ''; }
  });
}
