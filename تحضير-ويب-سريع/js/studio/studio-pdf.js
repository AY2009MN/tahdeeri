/* ═══ صفحات كتاب الطالب : التحميل وشريط الأدوات ═══
   (رسم الصفحات وردّ ذاكرتها في studio-render.js)
   يفتح العارض على صفحات الدرس وحدها (مع «كل الكتاب» عند الحاجة) ،
   ويمكن تصحيح بداية الدرس ونهايته فتُحفظ في الإعدادات. */

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

/* ترقيم الكتاب المطبوع مقابل صفحات PDF.
   الغلاف يزيح الجزء الأوّل صفحةً واحدة ، ثم تأتي صفحات فاصلة بلا ترقيم بين
   الجزأين فتزيد الإزاحة. الحدود مقيسة من الكتابين نفسيهما بقراءة رقم الصفحة
   المطبوع في كل صفحة ومقارنته برقمها في الملف :
     الثامن : ١..١٢٤ إزاحة ١ ، ثمّ ١٣ صفحة بلا ترقيم ، ومن ١٣٨ إزاحة ١٤.
     التاسع : ١..١١٤ إزاحة ١ ، ثمّ ١٤ صفحة بلا ترقيم ، ومن ١٢٩ إزاحة ١٥. */
const PAGE_SHIFT = { '8': { pdf: 138, printed: 124, big: 14 }, '9': { pdf: 129, printed: 114, big: 15 } };
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

/* ═══ رسم صفحات الكتاب ورَدُّ ذاكرتها ═══
   صفحة الكتاب لوحةٌ نقطية ، وثمنها ذاكرة : عرض × ارتفاع × ٤ بايت.
   فلو رُسم الكتاب كلّه دفعةً (٢٣٥ صفحة) لالتهم جيجابايتات وأسقط المتصفّح
   على الهاتف. لذلك هنا ثلاثة ضوابط :

     ١ ـ الرسم عند الحاجة : المراقِب جذرُه حاوية التمرير نفسها (.st-body) ،
         فلا تُرسم إلّا الصفحات القريبة من الشاشة.
     ٢ ـ دقّة بقدر العرض : تُرسم الصفحة بما يكفي لوضوحها على هذه الشاشة
         وللقصّ الحادّ ، لا بأقصى ما يستطيعه الجهاز.
     ٣ ـ ردّ الذاكرة : الصفحة التي تبتعد كثيراً تُفرَّغ لوحتها ويعود مكانها
         إطاراً فارغاً ، فتُرسم ثانيةً إن عاد إليها المعلّم.                 */

const PAGE_MARGIN = '1200px 0px';     // مدى الرسم المسبق حول الشاشة
const PAGE_KEEP = 6;                  // كم صفحة تبقى مرسومة حول الحالية
const MAX_PIXELS = 3.2e6;             // أقصى مساحة للوحة الواحدة

/** معامل الدقّة : يكفي لوضوح الشاشة وحدّة القصّ ، ولا يتجاوز سقف المساحة */
function pageDpr(vp) {
  const want = Math.min(2, window.devicePixelRatio || 1) * 1.25;
  const area = vp.width * vp.height * want * want;
  return area <= MAX_PIXELS ? want : want * Math.sqrt(MAX_PIXELS / area);
}

/** يفرّغ لوحة صفحة بعيدة ويعيد مكانها إطاراً بمقاسها */
function releasePage(wrap) {
  const cv = wrap.querySelector('canvas.vpage');
  if (!cv) return;
  wrap.style.height = Math.round(cv.getBoundingClientRect().height) + 'px';
  cv.width = cv.height = 0;           // ردّ الذاكرة فوراً لا عند كنس المهملات
  cv.remove();
  delete wrap.dataset.done;
}

/** يبقي المرسوم حول الصفحة الظاهرة ويفرّغ ما بعُد عنها */
function recyclePages() {
  const wraps = $$('#stPages .vpagewrap');
  const cur = currentBookPage();
  for (const w of wraps) {
    if (!w.dataset.done) continue;
    if (Math.abs(+w.dataset.p - cur) > PAGE_KEEP) releasePage(w);
  }
}

async function drawBookPages() {
  wirePageScroll();
  const host = byId('stPages');
  host.innerHTML = '';
  pageObserver?.disconnect();

  const from = bk.all ? 1 : bk.from, to = bk.all ? bk.doc.numPages : bk.to;
  const vp0 = (await bk.doc.getPage(from)).getViewport({ scale: bk.scale });
  const token = (bk.drawToken = Math.random());

  // الجذر حاوية التمرير نفسها ، وإلّا عُدَّت كلّ الصفحات ظاهرةً فرُسمت دفعةً
  pageObserver = new IntersectionObserver(
    es => es.forEach(en => { if (en.isIntersecting) renderBookPage(en.target, token); }),
    { root: $('.st-body'), rootMargin: PAGE_MARGIN });

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

  // المراقِب مربوط بدورة رسم الصفحة ، فإن كانت النافذة محجوبة أو التبويب
  // في الخلفية تأخّر أوّل نداء وظهرت إطارات فارغة. نرسم أوّل صفحتين يدوياً
  // فيرى المعلّم الكتاب فور فتحه ، ويتكفّل المراقِب بما بعدهما.
  for (const wrap of $$('#stPages .vpagewrap').slice(0, 2)) await renderBookPage(wrap, token);
}

async function renderBookPage(wrap, token) {
  if (wrap.dataset.done) return;
  wrap.dataset.done = '1';
  const page = await bk.doc.getPage(+wrap.dataset.p);
  if (token !== bk.drawToken) return;

  const vp = page.getViewport({ scale: bk.scale });
  const dpr = pageDpr(vp);
  const cv = document.createElement('canvas');
  cv.width = Math.round(vp.width * dpr);
  cv.height = Math.round(vp.height * dpr);
  cv.style.width = Math.round(vp.width) + 'px';
  cv.style.height = Math.round(vp.height) + 'px';
  cv.className = 'vpage';
  cv.dataset.p = wrap.dataset.p;

  const cx = cv.getContext('2d');
  cx.fillStyle = '#fff';
  cx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: cx, viewport: page.getViewport({ scale: bk.scale * dpr }) }).promise;
  page.cleanup();

  if (token !== bk.drawToken) { cv.width = cv.height = 0; return; }
  wrap.style.height = '';
  wrap.prepend(cv);
  recycleSoon();
}

const recycleSoon = debounce(recyclePages, 600);

/** شبكة أمان للتمرير : ترسم ما ظهر فعلاً إن تأخّر المراقِب أو تعطّل */
const ensureVisible = debounce(() => {
  const root = $('.st-body');
  if (!root || ST.tab !== 'pdf') return;
  const r = root.getBoundingClientRect();
  for (const w of $$('#stPages .vpagewrap')) {
    if (w.dataset.done) continue;
    const b = w.getBoundingClientRect();
    if (b.bottom > r.top - 400 && b.top < r.bottom + 400) renderBookPage(w, bk.drawToken);
  }
  recyclePages();
}, 250);

function wirePageScroll() {
  const root = $('.st-body');
  if (!root || root.dataset.scrollwired) return;
  root.dataset.scrollwired = '1';
  root.addEventListener('scroll', ensureVisible, { passive: true });
}
