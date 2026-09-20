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
