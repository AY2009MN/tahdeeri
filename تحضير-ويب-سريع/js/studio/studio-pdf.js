/* ═══ صفحات كتاب الطالب ═══
   يفتح العارض على صفحات الدرس وحدها (مع «كل الكتاب» عند الحاجة) ،
   ويمكن تصحيح بداية الدرس ونهايته فتُحفظ في الإعدادات.
   الرسم كسول : تُهيَّأ الإطارات بمقاسها وتُرسم الصفحة عند اقترابها من الشاشة. */

let PDFJS = null;
let bk = { id: null, doc: null, name: '', scale: 1.5, lesson: null,
           from: 1, to: 1, all: false, mode: 'rect', drawToken: 0 };
let pageObserver = null;

async function pdfLib() {
  if (PDFJS) return PDFJS;
  PDFJS = await import('../../vendor/pdf.mjs');
  PDFJS.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.mjs';
  if (!window.__rafPatched) {            // اللوحة قد تكون مخفيّة فتتوقّف إطارات الرسم
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => document.hidden ? setTimeout(() => cb(performance.now()), 0) : orig(cb);
    window.__rafPatched = true;
  }
  return PDFJS;
}

/** صفحات الدرس في ملف PDF : تصحيح المعلّم أوّلاً ، ثم الخريطة المرفقة */
const lessonRange = (gid, code) =>
  (S.pageMap?.[gid] || {})[code] || (window.BOOK_PAGES[gid] || {})[code] || null;

/* ترقيم الكتاب المطبوع مقابل صفحات PDF (الغلاف والمقدمات تزيح الجزء الثاني) */
const PAGE_SHIFT = { '8': { pdf: 144, printed: 130, big: 14 }, '9': { pdf: 135, printed: 120, big: 15 } };
const printedPage = (p, gid = grade) => {
  const k = PAGE_SHIFT[gid];
  return Math.max(1, p - (k && p >= k.pdf ? k.big : 1));
};
const pdfPageFromPrinted = (p, gid = grade) => {
  const k = PAGE_SHIFT[gid];
  return Math.max(1, p + (k && p >= k.printed ? k.big : 1));
};

/** يحمّل كتاب الصف الحالي من المكتبة ، ويرشد المعلّم إن لم يُضفه بعد */
async function loadBook(bookId) {
  const rows = await DB.all('books');
  const rec = (bookId && rows.find(b => b.id === bookId))
           || rows.find(b => b.role === 's' + grade)
           || (bk.id && rows.find(b => b.id === bk.id)) || null;
  if (!rec) return null;
  if (bk.id !== rec.id) {
    const lib = await pdfLib();
    bk.doc = await lib.getDocument({
      data: new Uint8Array(await rec.blob.arrayBuffer()),
      cMapUrl: 'vendor/cmaps/', cMapPacked: true,
      standardFontDataUrl: 'vendor/standard_fonts/',
      disableFontFace: true, useSystemFonts: false        // يحفظ تشكيل الحروف العربية سليماً
    }).promise;
    bk.id = rec.id; bk.name = rec.name;
  }
  return rec;
}

async function openBookPages(lessonCode) {
  const host = byId('stPages');
  host.innerHTML = '<p class="st-empty">جارٍ فتح الكتاب…</p>';
  const rec = await loadBook();
  if (!rec) {
    host.innerHTML = `<p class="st-empty">لم يُضَف كتاب الطالب لـ${esc(CURRICULA[grade].name)} بعد.<br>
      أضِفه من شاشة «الكتب» وحدّد دوره ، ليفتح العارض على صفحات الدرس تلقائياً.<br>
      <button class="btn primary" id="stGoLib" style="margin-top:12px">فتح شاشة الكتب</button></p>`;
    return;
  }
  const ses = curSession();
  bk.lesson = lessonCode || (ses && ses.code);
  const map = lessonRange(grade, bk.lesson);
  bk.from = map ? map[0] : 1;
  bk.to = Math.min(map ? map[1] : 6, bk.doc.numPages);
  bookBar();
  await drawBookPages();
}

function bookBar() {
  const lessons = lessonsOf(grade);
  byId('stBarPdf').innerHTML = `
    <label>الدرس <select id="stLesson">${lessons.map(l =>
      `<option value="${esc(l.code)}"${l.code === bk.lesson ? ' selected' : ''}>${esc(l.code)} ${esc(l.title)}</option>`).join('')}</select></label>
    <span class="meta">${bk.all ? `كل الكتاب (${ar(bk.doc.numPages)} صفحة)`
      : `صفحات الدرس: ص${ar(printedPage(bk.from))} ـ ص${ar(printedPage(bk.to))}`}</span>
    <button class="btn sm" id="stAll">${bk.all ? 'صفحات الدرس فقط' : 'كل الكتاب'}</button>
    <label>صفحة <input type="number" id="stPageNo" min="1" max="${bk.doc.numPages}" style="width:72px"></label>
    <button class="btn sm" id="stGo">اذهب</button>
    <span class="spacer"></span>
    <button class="btn sm${bk.mode === 'rect' ? ' primary' : ''}" id="stModeRect" title="تحديد مستطيل">▭ منتظم</button>
    <button class="btn sm${bk.mode === 'free' ? ' primary' : ''}" id="stModeFree" title="تحديد بالرسم">✎ حرّ</button>
    <button class="btn sm" id="stZout" title="تصغير">−</button>
    <button class="btn sm" id="stZin" title="تكبير">+</button>
    <button class="btn sm" id="stSetFrom" title="اجعل الصفحة الظاهرة بداية الدرس">بداية هنا</button>
    <button class="btn sm" id="stSetTo" title="اجعل الصفحة الظاهرة نهاية الدرس">نهاية هنا</button>`;
}

async function drawBookPages() {
  const host = byId('stPages');
  host.innerHTML = '';
  pageObserver?.disconnect();
  const from = bk.all ? 1 : bk.from, to = bk.all ? bk.doc.numPages : bk.to;
  const vp0 = (await bk.doc.getPage(from)).getViewport({ scale: bk.scale });
  const token = (bk.drawToken = Math.random());

  pageObserver = new IntersectionObserver(
    es => es.forEach(en => { if (en.isIntersecting) renderBookPage(en.target, token); }),
    { root: byId('stPaneP' + 'df') || host.parentElement, rootMargin: '900px 0px' });

  for (let p = from; p <= to; p++) {
    const wrap = document.createElement('div');
    wrap.className = 'vpagewrap';
    wrap.dataset.p = p;
    wrap.style.width = Math.round(vp0.width) + 'px';
    wrap.style.height = Math.round(vp0.height) + 'px';
    wrap.innerHTML = `<span class="vpno">ص ${ar(printedPage(p))}</span>`;
    host.appendChild(wrap);
    pageObserver.observe(wrap);
  }
}

async function renderBookPage(wrap, token) {
  if (wrap.dataset.done) return;
  wrap.dataset.done = '1';
  const page = await bk.doc.getPage(+wrap.dataset.p);
  if (token !== bk.drawToken) return;
  const vp = page.getViewport({ scale: bk.scale });
  const dpr = Math.min(2.5, (window.devicePixelRatio || 1) * 1.5);   // دقّة أعلى لقصّ حادّ
  const cv = document.createElement('canvas');
  cv.width = Math.round(vp.width * dpr); cv.height = Math.round(vp.height * dpr);
  cv.style.width = Math.round(vp.width) + 'px';
  cv.style.height = Math.round(vp.height) + 'px';
  cv.className = 'vpage'; cv.dataset.p = wrap.dataset.p;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: cx, viewport: page.getViewport({ scale: bk.scale * dpr }) }).promise;
  page.cleanup();
  wrap.style.height = '';
  wrap.prepend(cv);
}
