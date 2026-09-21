/* ═══ القصّ من صفحات الكتاب ═══
   تحديد منتظم (مستطيل) أو حرّ (بالرسم) فوق الصفحة ، ثم تفريغ الخلفية وقصّ
   الحواف تلقائياً ، وتُدرج اللقطة في موضع الإدراج المختار. */

/** الصفحة الظاهرة حالياً في أعلى العارض */
function currentBookPage() {
  const host = byId('stPages');
  const top = host.getBoundingClientRect().top + 60;
  let best = null;
  $$('.vpagewrap', host).forEach(w => {
    const r = w.getBoundingClientRect();
    if (r.top <= top && r.bottom > top) best = +w.dataset.p;
  });
  return best || +($('.vpagewrap', host)?.dataset.p || bk.from);
}

function gotoBookPage(p) {
  const w = $(`#stPages .vpagewrap[data-p="${p}"]`);
  if (w) return w.scrollIntoView({ block: 'start' });
  if (!bk.all && p >= 1 && p <= bk.doc.numPages) {     // خارج صفحات الدرس ← الكتاب كاملاً
    bk.all = true; bookBar();
    drawBookPages().then(() => gotoBookPage(p));
  }
}

const keepBookPage = async fn => { const p = currentBookPage(); await fn(); gotoBookPage(p); };

/** يقصّ المنطقة المحدَّدة من لوحة الصفحة بدقّتها الكاملة */
function cutFromCanvas(cv, pts, k) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
  if (w < 14 || h < 14) return null;
  const out = document.createElement('canvas');
  out.width = Math.round(w * k); out.height = Math.round(h * k);
  const ox = out.getContext('2d');
  if (bk.mode === 'free') {
    ox.beginPath();
    pts.forEach(([px, py], i) => ox[i ? 'lineTo' : 'moveTo']((px - x0) * k, (py - y0) * k));
    ox.closePath(); ox.clip();
  }
  ox.drawImage(cv, Math.round(x0 * k), Math.round(y0 * k), out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

/** رسم التحديد أثناء السحب */
function makeMark(cv, r) {
  let mark;
  if (bk.mode === 'free') {
    mark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mark.setAttribute('class', 'vlasso');
    mark.setAttribute('width', r.width); mark.setAttribute('height', r.height);
    mark.innerHTML = '<polygon points=""/>';
  } else {
    mark = document.createElement('div');
    mark.className = 'vsel';
  }
  cv.parentElement.appendChild(mark);
  return mark;
}

function wireCapture(v) {
  const host = byId('stPages');
  let st = null, mark = null, shot = null;
  const hideShot = () => byId('stShot').classList.add('hidden');
  const clearMark = () => { mark?.remove(); mark = null; };

  host.addEventListener('pointerdown', e => {
    if (!v.classList.contains('capturing')) return;
    const cv = e.target.closest('canvas.vpage');
    if (!cv) return;
    e.preventDefault();
    clearMark(); hideShot();
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    mark = makeMark(cv, r);
    st = { cv, r, pts: [[x, y]], sx: x, sy: y, ex: x, ey: y };
    cv.setPointerCapture?.(e.pointerId);
  });

  host.addEventListener('pointermove', e => {
    if (!st) return;
    const x = Math.max(0, Math.min(st.r.width, e.clientX - st.r.left));
    const y = Math.max(0, Math.min(st.r.height, e.clientY - st.r.top));
    st.ex = x; st.ey = y;
    if (bk.mode === 'free') {
      const last = st.pts[st.pts.length - 1];
      if (Math.hypot(x - last[0], y - last[1]) > 3) st.pts.push([x, y]);
      mark.firstChild.setAttribute('points', st.pts.map(p => p.join(',')).join(' '));
    } else {
      mark.style.cssText = `left:${Math.min(st.sx, x)}px;top:${Math.min(st.sy, y)}px;` +
        `width:${Math.abs(x - st.sx)}px;height:${Math.abs(y - st.sy)}px`;
    }
  });

  host.addEventListener('pointerup', () => {
    if (!st) return;
    const { cv, r } = st;
    const pts = bk.mode === 'free' ? st.pts
      : [[st.sx, st.sy], [st.ex, st.sy], [st.ex, st.ey], [st.sx, st.ey]];
    const enough = bk.mode !== 'free' || pts.length >= 6;
    st = null;
    const url = enough ? cutFromCanvas(cv, pts, cv.width / r.width) : null;
    if (!url) return clearMark();
    shot = { url, page: +cv.dataset.p };
    byId('stShotImg').src = url;
    byId('stShot').classList.remove('hidden');
  });

  v.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'stShotCancel') { clearMark(); shot = null; return hideShot(); }
    if (b.id !== 'stShotOk') return;
    if (!shot) return hideShot();
    b.disabled = true; b.textContent = '…جارٍ التجهيز';
    try {
      const url = await cleanShot(shot.url, byId('stClean').checked);
      await studioInsert(url);
    } finally {
      b.disabled = false; b.textContent = 'إدراج';
      clearMark(); shot = null; hideShot();
    }
  });
}

/* ═══ أزرار شريط صفحات الكتاب ═══
   فُصلت عن studio-pdf.js ليبقى كلّ ملف في حدود المراجعة السهلة :
   هناك الرسم والتحميل ، وهنا الاستجابة للأزرار. */

/** يحفظ تصحيح بداية الدرس أو نهايته في الإعدادات */
async function setLessonEdge(which) {
  const p = currentBookPage();
  S.pageMap ||= {};
  S.pageMap[grade] ||= {};
  const cur = lessonRange(grade, bk.lesson) || [p, p];
  const next = which === 'from' ? [p, Math.max(p, cur[1])] : [Math.min(cur[0], p), p];
  S.pageMap[grade][bk.lesson] = next;
  await DB.put('settings', S);
  bk.from = next[0]; bk.to = next[1]; bk.all = false;
  bookBar();
  await drawBookPages();
  toast(`حُفظت صفحات الدرس ${bk.lesson}: ص${ar(printedPage(next[0]))} ـ ص${ar(printedPage(next[1]))}`);
}

function wireBookPages(v) {
  v.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;

    if (b.id === 'stGoLib') { closeStudio(); return show('library'); }
    if (b.id === 'stModeRect') { bk.mode = 'rect'; return bookBar(); }
    if (b.id === 'stModeFree') { bk.mode = 'free'; return bookBar(); }
    if (b.id === 'stZin') { bk.scale = Math.min(3, bk.scale + 0.2); return keepBookPage(drawBookPages); }
    if (b.id === 'stZout') { bk.scale = Math.max(0.7, bk.scale - 0.2); return keepBookPage(drawBookPages); }
    if (b.id === 'stAll') {
      bk.all = !bk.all;
      bookBar();
      await drawBookPages();
      if (bk.all) gotoBookPage(bk.from);
      return;
    }
    if (b.id === 'stGo') return gotoBookPage(pdfPageFromPrinted(+byId('stPageNo').value));
    if (b.id === 'stSetFrom') return setLessonEdge('from');
    if (b.id === 'stSetTo') return setLessonEdge('to');
  });

  v.addEventListener('change', e => {
    if (e.target.id !== 'stLesson') return;
    bk.all = false;
    openBookPages(e.target.value);
  });

  v.addEventListener('keydown', e => {
    if (e.target.id === 'stPageNo' && e.key === 'Enter')
      gotoBookPage(pdfPageFromPrinted(+e.target.value));
  });
}

/* ═══ إدارة صور الورقة ═══
   جرد كامل لكلّ صورة أُدرجت في التحضير الحالي ، مع اسم قسمها وحجمها ،
   وأزرار للتحكّم بها من مكان واحد ـ أنفع ما يكون على الهاتف حيث يصعب
   الإمساك بالمقابض الصغيرة فوق الصورة نفسها. */

const sectionNameOf = el => {
  const f = el.closest('[contenteditable][data-f]')?.dataset.f;
  return (SLOTS.find(x => x.k === f) || {}).t || 'قسم غير معروف';
};

/** كل صور الورقة مرقّمة بترتيب ظهورها */
function myImages() {
  return inlAll().map((sp, i) => ({
    i, sp,
    src: sp.querySelector('img')?.src || '',
    w: +sp.dataset.w || 90,
    sec: sectionNameOf(sp),
    free: sp.classList.contains('free')
  }));
}

const mgBtn = (i, act, label, title) =>
  `<button data-mg="${act}" data-mgi="${i}" title="${title}" aria-label="${title}">${label}</button>`;

function myImageRow(it) {
  return `<div class="st-item">
    <img src="${esc(it.src)}" alt="">
    <div class="info">
      <b>${esc(it.sec)}</b>
      <span>العرض ${ar(it.w)}٪${it.free ? ' · وضع حرّ' : ''}</span>
    </div>
    <div class="acts">
      ${mgBtn(it.i, 'w:-10', '−', 'تصغير')}
      ${mgBtn(it.i, 'w:10', '+', 'تكبير')}
      ${mgBtn(it.i, 'al:r', '⇥', 'محاذاة يمين')}
      ${mgBtn(it.i, 'al:c', '≡', 'توسيط')}
      ${mgBtn(it.i, 'al:l', '⇤', 'محاذاة يسار')}
      ${mgBtn(it.i, 'up', '▲', 'نقل للأعلى')}
      ${mgBtn(it.i, 'down', '▼', 'نقل للأسفل')}
      ${mgBtn(it.i, 'crop', '✂', 'اقتصاص')}
      ${mgBtn(it.i, 'clean', '▨', 'تفريغ الخلفية')}
      ${mgBtn(it.i, 'goto', '🔎', 'إظهارها في الورقة')}
      ${mgBtn(it.i, 'del', '🗑', 'حذف')}
    </div>
  </div>`;
}

function renderMyImages() {
  const list = myImages();
  byId('stList').innerHTML = list.length
    ? `<p class="hint" style="color:#b9cbdd;margin:0 0 10px">${
         ar(list.length)} صورة في هذا التحضير ـ تحكّم بها من هنا بلا حاجة إلى تكبير الورقة.</p>`
       + list.map(myImageRow).join('')
    : `<p class="st-empty">لا صور في هذه الورقة بعد.<br>
        افتح «معرض الدرس» وأدرج ما تحتاجه بنقرة واحدة.</p>`;
}

function wireMyImages(v) {
  v.addEventListener('click', async e => {
    const b = e.target.closest('[data-mg]');
    if (!b) return;
    const it = myImages()[+b.dataset.mgi];
    if (!it) return renderMyImages();
    const [a, val] = b.dataset.mg.split(':');

    if (a === 'goto') {
      if (!isWide()) closeStudio();
      inlSelect(it.sp);
      it.sp.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (a === 'del') {
      if (!confirm('حذف هذه الصورة من ورقة التحضير؟')) return;
      inlRemove(it.sp);
      return renderMyImages();
    }
    if (a === 'crop') {
      if (!isWide()) closeStudio();
      return inlCrop(it.sp);
    }
    b.disabled = true;
    await inlAction(a, val, it.sp, b);
    b.disabled = false;
    inlSave(it.sp);
    renderMyImages();
  });
}
