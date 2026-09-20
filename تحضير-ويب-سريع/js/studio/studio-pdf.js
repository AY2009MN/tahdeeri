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
