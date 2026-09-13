/* =====================================================================
   المكتبة + عارض الدرس المدمج
   ــ المكتبة : أضِف كتاب الطالب أو دليل المعلّم ، وحدّد دور كلّ ملف.
   ــ عارض الدرس : مرتبط بحصة التحضير المفتوحة ـ يعرض صفحات درسها وحدها
      (مع زرّ «كل الكتاب» عند الحاجة) ، ويمكن تصحيح بداية الدرس ونهايته.
   ــ اللقطة : تحديد منتظم (مستطيل) أو حرّ (بالرسم) ، ثم تفريغ الخلفية وقصّ
      الحواف تلقائياً ، وتُدرج في موضع المؤشّر أو مكان «الإدراج» المختار.
   ــ على الشاشات العريضة يظهر العارض بجانب ورقة التحضير فترى الإدراج مباشرة.
   ===================================================================== */

let PDFJS = null;
let bk = { id: null, doc: null, name: '', scale: 1.5, lesson: null, from: 1, to: 1, all: false, mode: 'rect' };

async function pdfLib() {
  if (PDFJS) return PDFJS;
  PDFJS = await import('../vendor/pdf.mjs');
  PDFJS.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.mjs';
  if (!window.__rafPatched) {              // العارض قد يكون مخفيّاً فتتوقّف إطارات الرسم
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => document.hidden ? setTimeout(() => cb(performance.now()), 0) : orig(cb);
    window.__rafPatched = true;
  }
  return PDFJS;
}

const ROLES = { s8: 'كتاب الطالب ـ الثامن', s9: 'كتاب الطالب ـ التاسع',
                g8: 'دليل المعلّم ـ الثامن', g9: 'دليل المعلّم ـ التاسع', other: 'ملف آخر' };

/* ────────── المكتبة ────────── */
async function renderLibrary() {
  const box = document.getElementById('bookList'); if (!box) return;
  const rows = await DB.all('books');
  box.innerHTML = rows.length ? rows.map(b => `
    <div class="bookcard">
      <b>${esc(b.name)}</b>
      <small>${ar(Math.round(b.size / 1048576))} م.ب · أُضيف ${fmtDate(b.added)}</small>
      <label class="rowlbl">دوره
        <select data-role="${esc(b.id)}">
          ${Object.entries(ROLES).map(([k, t]) =>
            `<option value="${k}" ${b.role === k ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <div class="row">
        <button class="btn" data-openbook="${esc(b.id)}">تصفّح</button>
        <button class="btn" data-delbook="${esc(b.id)}">حذف</button>
      </div>
    </div>`).join('')
    : '<p class="hint">لم تُضف ملفات بعد. أضِف كتاب الطالب للصفين، وحدّد دور كلّ ملف، ليفتح العارض على صفحات الدرس تلقائياً.</p>';
}

async function addBook(file) {
  if (!file || file.type !== 'application/pdf') return alert('الملف يجب أن يكون بصيغة PDF.');
  const name = file.name.replace(/\.pdf$/i, '');
  const role = /تاسع|9/.test(name) ? (/دليل/.test(name) ? 'g9' : 's9')
             : /ثامن|8/.test(name) ? (/دليل/.test(name) ? 'g8' : 's8') : 'other';
  await DB.put('books', { id: 'b' + Date.now(), name, size: file.size, role,
                          added: iso(new Date()), blob: file });
  renderLibrary();
}

/* ────────── صفحات الدرس ────────── */
/** صفحات الدرس في ملف PDF: تصحيح المعلّم أولاً ، ثم الخريطة المرفقة */
function lessonRange(gid, code) {
  const o = S.pageMap && S.pageMap[gid] && S.pageMap[gid][code];
  return o || (window.BOOK_PAGES[gid] || {})[code] || null;
}
const printedPage = p => p - 1;           // ترقيم الكتاب المطبوع = صفحة PDF − ١ (للكتابين)

/* ────────── عارض الدرس ────────── */
/** يُستدعى من «إدراج من الكتاب» أو من مكان إدراج جاهز داخل الورقة */
async function openInsertViewer() {
  wireViewer();
  bk.all = false;
  await openLessonViewer();
  const v = document.getElementById('viewer');
  v.classList.add('capturing');
}

async function openLessonViewer(lessonCode, bookId) {
  const rows = await DB.all('books');
  const rec = (bookId && rows.find(b => b.id === bookId))
            || rows.find(b => b.role === 's' + grade)
            || (bk.id && rows.find(b => b.id === bk.id)) || null;
  if (!rec) {
    show('library');
    return alert(`أضِف «كتاب الطالب» الخاص بـ${CURRICULA[grade].name} من شاشة «الكتب» وحدّد دوره، ليفتح العارض على صفحات الدرس.`);
  }

  if (bk.id !== rec.id) {
    const lib = await pdfLib();
    bk.doc = await lib.getDocument({ data: new Uint8Array(await rec.blob.arrayBuffer()),
      cMapUrl: 'vendor/cmaps/', cMapPacked: true, standardFontDataUrl: 'vendor/standard_fonts/',
      disableFontFace: true, useSystemFonts: false }).promise;   // يحفظ تشكيل الحروف العربية سليماً
    bk.id = rec.id; bk.name = rec.name;
  }
  const ses = sessionsIdx[grade][curIdx];
  bk.lesson = lessonCode || (ses && ses.code);
  const map = lessonRange(grade, bk.lesson);
  bk.from = map ? map[0] : 1;
  bk.to   = Math.min(map ? map[1] : 6, bk.doc.numPages);

  document.getElementById('viewer').classList.remove('hidden');
  document.body.classList.add('viewing');
  buildViewerHead();
  await drawLessonPages();
}

function buildViewerHead() {
  const lessons = [];
  CURRICULA[grade].units.forEach(u => u.lessons.forEach(l => lessons.push(l)));
  const ses = sessionsIdx[grade][curIdx];
  const lsn = lessons.find(l => l.code === bk.lesson);
  const nSes = lsn ? lsn.sessions.length : 1;

  document.getElementById('vTitle').textContent = `${bk.name} — ${bk.lesson || ''} ${lsn ? lsn.title : ''}`;
  document.getElementById('vLesson').innerHTML = lessons.map(l =>
    `<option value="${esc(l.code)}" ${l.code === bk.lesson ? 'selected' : ''}>${esc(l.code)} ${esc(l.title)}</option>`).join('');
  document.getElementById('vSes').innerHTML = Array.from({ length: nSes }, (_, k) =>
    `<option value="${k}">الحصة ${ar(k + 1)} من ${ar(nSes)}</option>`).join('');
  document.getElementById('vSlot').innerHTML = window.SLOTS.map(s =>
    `<option value="${s.k}">${s.t}</option>`).join('');
  document.getElementById('vSes').value = String(ses && ses.code === bk.lesson ? ses.partIdx - 1 : 0);
  document.getElementById('vRange').textContent = bk.all
    ? `كل الكتاب (${ar(bk.doc.numPages)} صفحة)`
    : `صفحات الدرس: ص${ar(printedPage(bk.from))} ـ ص${ar(printedPage(bk.to))}`;
  document.getElementById('vAll').textContent = bk.all ? 'صفحات الدرس فقط' : 'كل الكتاب';
  document.getElementById('vModeRect').classList.toggle('primary', bk.mode === 'rect');
  document.getElementById('vModeFree').classList.toggle('primary', bk.mode === 'free');

  // الهدف: موضع المؤشّر / مكان إدراج جاهز ـ وإلا يظهر اختيار الحصة والموضع
  const tgt = typeof inlTargetName === 'function' ? inlTargetName() : '';
  document.getElementById('vTarget').innerHTML = tgt
    ? `تُدرج اللقطة في: <b>${esc(tgt)}</b>`
    : 'انقر داخل «المقدمة» أو «العرض» في الورقة لتحديد موضع الإدراج، أو اختر:';
  document.getElementById('vFallback').classList.toggle('hidden', !!tgt);
}

/* الرسم الكسول: تُهيَّأ إطارات الصفحات بمقاسها ، وتُرسم الصفحة عند اقترابها من الشاشة */
let pageObserver = null;
async function drawLessonPages() {
  const host = document.getElementById('vPages');
  host.innerHTML = '';
  if (pageObserver) pageObserver.disconnect();
  const from = bk.all ? 1 : bk.from, to = bk.all ? bk.doc.numPages : bk.to;
  const first = await bk.doc.getPage(from);
  const vp0 = first.getViewport({ scale: bk.scale });
  const token = (bk.drawToken = Math.random());

  pageObserver = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) renderPage(en.target, token); });
  }, { root: host, rootMargin: '900px 0px' });

  for (let p = from; p <= to; p++) {
    const wrap = document.createElement('div');
    wrap.className = 'vpagewrap'; wrap.dataset.p = p;
    wrap.style.width = Math.round(vp0.width) + 'px';
    wrap.style.height = Math.round(vp0.height) + 'px';
    wrap.innerHTML = `<span class="vpno">ص ${ar(printedPage(p))}</span>`;
    host.appendChild(wrap);
    pageObserver.observe(wrap);
  }
  document.getElementById('vPageNo').max = bk.doc.numPages;
}

async function renderPage(wrap, token) {
  if (wrap.dataset.done) return;
  wrap.dataset.done = '1';
  const p = +wrap.dataset.p;
  const page = await bk.doc.getPage(p);
  if (token !== bk.drawToken) return;
  const vp = page.getViewport({ scale: bk.scale });
  const dpr = Math.min(2.5, (window.devicePixelRatio || 1) * 1.5);      // دقّة أعلى لقصّ حادّ
  const cv = document.createElement('canvas');
  cv.width = Math.round(vp.width * dpr); cv.height = Math.round(vp.height * dpr);
  cv.style.width = Math.round(vp.width) + 'px'; cv.style.height = Math.round(vp.height) + 'px';
  cv.className = 'vpage'; cv.dataset.p = p;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: cx, viewport: page.getViewport({ scale: bk.scale * dpr }) }).promise;
  page.cleanup();
  wrap.style.height = '';
  wrap.prepend(cv);
}

/** الصفحة الظاهرة حالياً في أعلى العارض */
function currentViewerPage() {
  const host = document.getElementById('vPages'), top = host.getBoundingClientRect().top + 60;
  let best = null;
  host.querySelectorAll('.vpagewrap').forEach(w => {
    const r = w.getBoundingClientRect();
    if (r.top <= top && r.bottom > top) best = +w.dataset.p;
  });
  return best || +(host.querySelector('.vpagewrap')?.dataset.p || bk.from);
}

function closeViewer() {
  document.getElementById('viewer').classList.add('hidden');
  document.body.classList.remove('viewing');
}

/* ────────── التحديد : مستطيل أو حرّ ────────── */
function wireViewer() {
  const v = document.getElementById('viewer'); if (!v || v.dataset.wired) return;
  v.dataset.wired = '1';
  const host = document.getElementById('vPages');
  let st = null, mark = null, shot = null;
  const hideShot = () => document.getElementById('vShot').classList.add('hidden');
  const clearMark = () => { if (mark) { mark.remove(); mark = null; } };

  host.addEventListener('pointerdown', e => {
    if (!v.classList.contains('capturing')) return;
    const cv = e.target.closest('canvas.vpage'); if (!cv) return;
    e.preventDefault();
    clearMark(); hideShot();
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (bk.mode === 'free') {
      mark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      mark.setAttribute('class', 'vlasso');
      mark.setAttribute('width', r.width); mark.setAttribute('height', r.height);
      mark.innerHTML = '<polygon points=""/>';
    } else {
      mark = document.createElement('div'); mark.className = 'vsel';
    }
    cv.parentElement.appendChild(mark);
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
      mark.style.cssText = `left:${Math.min(st.sx, x)}px;top:${Math.min(st.sy, y)}px;width:${Math.abs(x - st.sx)}px;height:${Math.abs(y - st.sy)}px`;
    }
  });

  host.addEventListener('pointerup', () => {
    if (!st) return;
    const { cv, r } = st, k = cv.width / r.width;
    let pts = bk.mode === 'free' ? st.pts
      : [[st.sx, st.sy], [st.ex, st.sy], [st.ex, st.ey], [st.sx, st.ey]];
    st = null;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
    if (w < 14 || h < 14 || (bk.mode === 'free' && pts.length < 6)) { clearMark(); return; }

    const out = document.createElement('canvas');
    out.width = Math.round(w * k); out.height = Math.round(h * k);
    const ox = out.getContext('2d');
    if (bk.mode === 'free') {
      ox.beginPath();
      pts.forEach(([px, py], i) => ox[i ? 'lineTo' : 'moveTo']((px - x0) * k, (py - y0) * k));
      ox.closePath(); ox.clip();
    }
    ox.drawImage(cv, Math.round(x0 * k), Math.round(y0 * k), out.width, out.height, 0, 0, out.width, out.height);
    shot = { url: out.toDataURL('image/png'), page: +cv.dataset.p };
    document.getElementById('vShotImg').src = shot.url;
    buildViewerHead();
    document.getElementById('vShot').classList.remove('hidden');
  });

  v.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'vClose')    return closeViewer();
    if (b.id === 'vCapture')  { v.classList.toggle('capturing'); b.classList.toggle('primary', v.classList.contains('capturing')); return; }
    if (b.id === 'vModeRect') { bk.mode = 'rect'; v.classList.add('capturing'); return buildViewerHead(); }
    if (b.id === 'vModeFree') { bk.mode = 'free'; v.classList.add('capturing'); return buildViewerHead(); }
    if (b.id === 'vZin')      { bk.scale = Math.min(3, bk.scale + 0.2); return keepPage(drawLessonPages); }
    if (b.id === 'vZout')     { bk.scale = Math.max(0.7, bk.scale - 0.2); return keepPage(drawLessonPages); }
    if (b.id === 'vAll')      { bk.all = !bk.all; buildViewerHead(); await drawLessonPages(); if (bk.all) gotoPage(bk.from); return; }
    if (b.id === 'vGo')       return gotoPage(+document.getElementById('vPageNo').value + 1);
    if (b.id === 'vSetFrom' || b.id === 'vSetTo') {
      const p = currentViewerPage();
      S.pageMap ||= {}; S.pageMap[grade] ||= {};
      const cur = lessonRange(grade, bk.lesson) || [p, p];
      const next = b.id === 'vSetFrom' ? [p, Math.max(p, cur[1])] : [Math.min(cur[0], p), p];
      S.pageMap[grade][bk.lesson] = next;
      await DB.put('settings', S);
      bk.from = next[0]; bk.to = next[1]; bk.all = false;
      buildViewerHead(); await drawLessonPages();
      return toast(`حُفظت صفحات الدرس ${bk.lesson}: ص${ar(printedPage(next[0]))} ـ ص${ar(printedPage(next[1]))}`);
    }
    if (b.id === 'vText') {
      const t = prompt('النصّ الذي يُضاف إلى ورقة التحضير :');
      if (t) insertTextAt(t, document.getElementById('vSes').value, document.getElementById('vSlot').value);
      return;
    }
    if (b.id === 'vShotCancel') { clearMark(); shot = null; return hideShot(); }
    if (b.id === 'vShotOk') {
      if (!shot) return hideShot();
      b.disabled = true; b.textContent = '…جارٍ التجهيز';
      try {
        let url = shot.url;
        if (document.getElementById('vClean').checked) { try { url = await removeWhite(url); } catch {} }
        try { url = await trimImage(url); } catch {}
        const label = document.getElementById('vLabel').value.trim();
        if (typeof insertInline === 'function' && inlTarget()) {
          await insertInline(url);
          if (!window.matchMedia('(min-width:1100px)').matches) closeViewer();
          toast('أُدرجت اللقطة ✓');
        } else {
          await insertShot(url, label, +document.getElementById('vSes').value,
                           document.getElementById('vSlot').value, shot.page);
        }
      } finally {
        b.disabled = false; b.textContent = 'إدراج';
        clearMark(); shot = null; hideShot();
        document.getElementById('vLabel').value = '';
        buildViewerHead();
      }
    }
  });

  v.addEventListener('change', e => {
    if (e.target.id === 'vLesson') { bk.all = false; openLessonViewer(e.target.value); }
  });
  document.getElementById('vPageNo').addEventListener('keydown', e => {
    if (e.key === 'Enter') gotoPage(+e.target.value + 1);
  });
}

async function keepPage(fn) { const p = currentViewerPage(); await fn(); gotoPage(p); }

function gotoPage(p) {
  const host = document.getElementById('vPages');
  const w = host.querySelector(`.vpagewrap[data-p="${p}"]`);
  if (w) { w.scrollIntoView({ block: 'start' }); return; }
  if (!bk.all && p >= 1 && p <= bk.doc.numPages) {           // خارج صفحات الدرس ← اعرض الكتاب كاملاً
    bk.all = true; buildViewerHead(); drawLessonPages().then(() => gotoPage(p));
  }
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast no-print'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 1800);
  setTimeout(() => t.remove(), 2300);
}

/* ────────── الإدراج القديم (عند غياب موضع المؤشّر) ────────── */
function lessonSessionIndex(sesNo) {
  const first = sessionsIdx[grade].findIndex(x => x.code === bk.lesson);
  return first < 0 ? curIdx : first + (+sesNo || 0);
}

async function insertShot(url, label, sesNo, slot, page) {
  const idx = lessonSessionIndex(sesNo);
  const s = sessionsIdx[grade][idx];
  const p = prepCache[s.id] || (prepCache[s.id] = { id: s.id });
  const list = (p.figs !== undefined ? p.figs : (s.figs || [])).slice();
  list.push({ ...FIG_DEFAULTS, src: url, sec: slot,
              cap: `${bk.name} ـ ص${ar(printedPage(page))}`,
              label: label || '', labelPos: 'top', labelSize: 13 });
  p.figs = list;
  curIdx = idx;
  markDirty(s);
  closeViewer();
  show('editor');
  setTimeout(() => checkSlotFull(slot, idx), 500);
}

function insertTextAt(text, sesNo, slot) {
  const idx = lessonSessionIndex(sesNo);
  const s = sessionsIdx[grade][idx];
  const p = prepCache[s.id] || (prepCache[s.id] = { id: s.id });
  const now = p[slot] !== undefined ? p[slot] : (s[slot] || '');
  p[slot] = (now ? now + '\n' : '') + text;
  curIdx = idx;
  markDirty(s);
  closeViewer();
  show('editor');
}

/* تنبيه امتلاء الصندوق بعد الإدراج */
function checkSlotFull(slot, idx) {
  const el = document.querySelector(`.sectbox[data-f="${slot}"]`);
  const wrap = el ? (el.closest('.sectwrap') || el) : null;
  if (!wrap || wrap.scrollHeight <= wrap.clientHeight + 6) return;
  const name = (window.SLOTS.find(x => x.k === slot) || {}).t || slot;
  const move = slot !== 'show2' && confirm(
    `امتلأ «${name}».\n\nموافق : ننقل الصورة الأخيرة إلى «تابع العرض ـ صفحة ٢».\nإلغاء : نصغّر صور هذا الصندوق لتتّسع.`);
  const s = sessionsIdx[grade][idx];
  const list = figsOf(s);
  const inSlot = list.map((f, i) => ({ f, i })).filter(o => (o.f.sec || 'show') === slot);
  if (!inSlot.length) return;
  if (move) inSlot[inSlot.length - 1].f.sec = 'show2';
  else inSlot.forEach(o => { o.f.w = Math.max(30, o.f.w - 12); });
  setFigs(s, list);
  renderEditor();
}
