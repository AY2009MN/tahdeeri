/* ═══ محرّر التحضير : رسم الورقة وربطها ═══ */

function openEditor(gid, idx, clsId) {
  const cc = curClass();
  const c = clsId ? S.classes.find(x => x.id === clsId)
                  : (cc && cc.g === gid ? cc : S.classes.find(x => x.g === gid));
  if (c) { S.cls = c.id; applyClass(); setVal('gradeSel', c.id); }
  grade = gid; curIdx = idx;
  show('editor');
}

/** قوائم الوحدة والدرس والحصة ـ تتبع الحصة المفتوحة */
function fillPicker() {
  const list = sessions(), cur = list[curIdx];
  if (!cur) return;
  const U = byId('unitSel'), L = byId('lessonSel'), P = byId('partSel');
  if (!U || !L || !P) return;

  const opt = (val, txt, on) => `<option value="${esc(val)}"${on ? ' selected' : ''}>${esc(txt)}</option>`;

  U.innerHTML = [...new Set(list.map(s => s.unitNo))].map(u =>
    opt(u, `الوحدة ${u} ـ ${list.find(s => s.unitNo === u).unitTitle}`, u === cur.unitNo)).join('');

  L.innerHTML = [...new Set(list.filter(s => s.unitNo === cur.unitNo).map(s => s.code))].map(code =>
    opt(code, `${code} ${list.find(s => s.code === code).title}`, code === cur.code)).join('');

  P.innerHTML = list.filter(s => s.code === cur.code).map(s =>
    opt(s.n, `الحصة ${ar(s.partIdx)} من ${ar(s.partOf)}`, s.n === cur.n)).join('');
}

/** يربط كلّ حقل قابل للتحرير بحفظ محتواه في التحضير */
function wireFields(paper, s) {
  $$('[contenteditable][data-f]', paper).forEach(el => {
    el.addEventListener('input', () => {
      const p = prepFor(s);
      p[el.dataset.f] = el.classList.contains('sectbox') ? cleanHTML(el) : el.innerText;
      markDirty(s);
    });
  });
}

function renderEditor() {
  const list = sessions();
  if (!list.length) return;
  curIdx = Math.max(0, Math.min(curIdx, list.length - 1));
  const s = list[curIdx];

  const prev = byId('prevSes'), next = byId('nextSes');
  if (prev) prev.disabled = curIdx <= 0;
  if (next) next.disabled = curIdx >= list.length - 1;
  setText('sesLabel', `${s.code} ${s.title} — الحصة ${ar(s.partIdx)} من ${ar(s.partOf)} · ${fmtDate(s.date)}`);

  const paper = byId('paper');
  paper.style.setProperty('--sheetfs', (S.fontSize || 14) + 'px');
  paper.innerHTML = sheetHTML(s);

  flowShow(s);
  wireFields(paper, s);
  wireFigs();
  inlRestoreFree(paper);
  lockApply();
  wireInline();
  wireBoxClick();
  fillPicker();
  applyViewMode();
  studioRefreshIfOpen();
  // الضبط التلقائي لا يصحّ إلّا بعد اكتمال تحميل الصور ، وإلّا قيست الأحجام صفراً
  hydrateAssets(paper).then(() => imagesReady(paper)).then(autoFitPages);
  checkOverflow();
}

/** ينتظر اكتمال صور الورقة (بمهلة قصوى حتى لا يتعلّق الرسم) */
function imagesReady(root, timeout = 1500) {
  const pending = $$('img', root).filter(i => !i.complete);
  if (!pending.length) return Promise.resolve();
  return Promise.all(pending.map(i => new Promise(r => {
    i.onload = i.onerror = r;
    setTimeout(r, timeout);
  })));
}

/* ═══ تنقّل الحصص ═══ */
function gotoSession(delta) {
  curIdx = Math.max(0, Math.min(curIdx + delta, sessions().length - 1));
  renderEditor();
  byId('paper')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/* ═══ إدراج صورة من جهاز المعلّم ═══
   كلّ صورة تدخل مجرى النصّ (inline) ، فنظام واحد للصور لا نظامان.
   وإن لم يكن المؤشّر في صندوق ، فصندوق «العرض» هو المقصد المعقول. */
async function insertImage(file) {
  const dataUrl = await shrinkImage(file, 1200, 0.8);
  if (!inlTarget() && !inlSetTarget('show')) return alert('افتح ورقة التحضير أوّلاً.');
  await insertInline(dataUrl);
}

/** يُرجع الحصة إلى نصّها الأصلي في المنهج ـ مخرج المعلّم إن أفسد ورقة ،
    إذ لا تراجع بعد إغلاق الصفحة. يمسّ هذه الحصة وحدها. */
async function resetSession() {
  const s = curSession();
  if (!s) return;
  const what = `${s.code} ${s.title} ـ الحصة ${ar(s.partIdx)}`;
  if (!confirm(`استعادة «${what}» إلى نصّها الأصلي في المنهج؟\n\n` +
               'يُحذف ما كتبتَه وما أدرجتَه من صور في هذه الحصة وحدها.')) return;
  delete prepCache[s.id];
  await DB.del('preps', s.id);
  s.status = 'planned';
  await DB.put('sessions', { id: s.id, date: s.date, period: s.period, status: 'planned' });
  renderEditor();
  refreshStats();
  toast('استُعيد نصّ الدرس الأصلي ✓');
}

/* ═══ الطباعة ═══
   تُطبع ورقة الشاشة نفسها ، ويفرض css/print.css مقاس A4 الحقيقي مهما كان
   وضع العرض ، فتخرج الطباعة مطابقة في الهاتف والحاسوب معاً. */

/** ينتظر فكّ ترميز الصور بمهلة قصوى.
    decode() لا يستقرّ أبداً ما دامت الصفحة مخفيّة (تبويب في الخلفية أو نافذة
    محجوبة) ، فلو انتظرناه بلا حدّ لما وصلنا إلى window.print أصلاً ولبدا
    زرّ الطباعة معطّلاً. الصور محمّلة أصلاً ، وفكّ الترميز تحسين لا شرط. */
function decodeAll(imgs, ms = 1200) {
  const all = Promise.all(imgs.map(im => im.decode ? im.decode().catch(() => {}) : 0));
  return Promise.race([all, new Promise(r => setTimeout(r, ms))]);
}

/** يهيّئ الورقة للطباعة : هندسة A4 حقيقية ، بلا تحديد ولا تصغير ، والصور محمّلة.
    فرض A4 هنا ضروريّ : في «وضع الشاشة» تتمدّد الصناديق بارتفاع محتواها ، فلو
    قِسنا الامتلاء عليها لظننّا كلّ شيء متّسعاً ثم خرجت الطباعة مقصوصة. */
async function preparePrint(paper) {
  figSel = null;
  inlDeselect();
  paper.classList.remove('zoomed');
  forceA4();
  await new Promise(r => setTimeout(r, 250));
  await decodeAll($$('img', paper));
  // الضبط قبل الطباعة مباشرة : لا تخرج صورة مقصوصة لأنّ صندوقها امتلأ
  return fitAllBoxes(false);
}

/** يستأذن المعلّم إن بقي صندوق ممتلئاً بعد التصغير ، فلا يُقصّ شيء وهو لا يدري */
function confirmIfClipped(stuck) {
  if (!stuck) return true;
  return confirm(
    `تنبيه: ${ar(stuck)} ${stuck === 1 ? 'صندوق ممتلئ' : 'صناديق ممتلئة'} حتى بعد تصغير الصور ،\n` +
    'وما يتجاوز حدّ الصفحة لن يظهر في الورقة المطبوعة.\n\n' +
    'موافق : اطبع كما هو.\nإلغاء : أعود لأحذف عنصراً أو أنقله إلى «تابع العرض».');
}

/* حارسٌ أخير : عدد الصفحات التي ستخرج فعلاً = ارتفاع الورقة ÷ ارتفاع A4.
   يُقاس #paper وحده ـ لا #view-editor ـ فالشريطان لا يُطبعان ، وإدخالهما في
   القياس كان يمنع طباعةً سليمة. ولا يصحّ إلّا بعد forceA4 وإزالة التصغير. */
function pagesBeyondTwo(expected) {
  const A4 = 297 * 96 / 25.4;
  const paper = byId('paper');
  const h = Math.max(paper.scrollHeight, paper.getBoundingClientRect().height);
  const sheets = $$('#paper .sheet, #paper .wsheet').length || expected;
  return Math.max(0, Math.ceil(h / A4 - 0.04) - Math.max(expected, sheets));
}

/** يفرض هندسة A4 على الشاشة قبل الطباعة ، فتتطابق المعاينة والمخرج */
function forceA4() {
  document.body.classList.remove('screenmode');
  document.body.classList.add('a4mode');
}

/** يعيد الورقة إلى وضع العرض بعد انتهاء الطباعة */
function afterPrint(rerender) {
  setTimeout(() => { if (rerender) renderEditor(); applyViewMode(); }, 400);
}

async function printCurrent(mode) {
  const s = curSession();
  const paper = byId('paper');
  byId('printArea').innerHTML = '';

  if (mode === 'worksheet') {
    /* لا نطبع ورقةً فيها سطرٌ واحد : المنهج لا يعرّف ورقة عمل لأيّ حصة بعد ،
       فكان الزرّ يُخرج صفحةً بيضاء تُهدر. */
    if (!s.worksheet) return alert('لا توجد ورقة عمل لهذه الحصة ـ لم يُعدّ لها محتوى بعد.');
    paper.innerHTML = worksheetHTML(s);
    paper.classList.remove('zoomed');
    forceA4();
    await new Promise(r => setTimeout(r, 150));
    window.print();
    return afterPrint(true);
  }

  renderEditor();
  const { stuck } = await preparePrint(paper);
  if (!confirmIfClipped(stuck)) return afterPrint(false);
  const extra = pagesBeyondTwo(2);
  if (extra) {
    alert(`تنبيه: الورقة ستخرج في ${ar(2 + extra)} صفحات لا صفحتين.\n\n` +
          'أُلغيت الطباعة لئلّا تُهدر ورقة. أبلِغ بهذا ـ فهو خلل في القالب لا في تحضيرك.');
    return afterPrint(false);
  }
  window.print();
  afterPrint(false);
}

/** طباعة تحضيرات الأسبوع الحالي للشعبة المختارة */
async function printWeekSessions() {
  const c = curClass();
  if (!c) return;
  const dates = classDates[c.id] || [], list = sessionsIdx[c.g] || [];
  const week = new Set(weekOf());
  const weekSessions = [];
  dates.forEach((d, i) => { if (d && week.has(d.date) && list[i]) weekSessions.push(list[i]); });

  if (!weekSessions.length)
    return alert(`لا توجد حصص مجدولة هذا الأسبوع لشعبة ${c.name} (${CURRICULA[c.g].name}).`);
  if (!confirm(`طباعة تحضيرات هذا الأسبوع كاملة (${ar(weekSessions.length)} حصص لشعبة ${c.name})؟`)) return;

  byId('printArea').innerHTML = '';
  const oldCur = curIdx;
  show('editor');
  const paper = byId('paper');
  paper.innerHTML = weekSessions.map(sheetHTML).join('');
  await hydrateAssets(paper);
  const { stuck } = await preparePrint(paper);
  if (!confirmIfClipped(stuck)) return setTimeout(() => { curIdx = oldCur; renderEditor(); }, 100);
  window.print();
  setTimeout(() => { curIdx = oldCur; renderEditor(); }, 400);
}

/** نسخ فارغة من القالب للكتابة اليدوية ـ العدد يختاره المعلّم */
async function printBlank() {
  const ans = prompt('كم نسخة فارغة تريد طباعتها؟ (كل نسخة صفحتان)', '1');
  if (ans === null) return;
  const n = Math.max(1, Math.min(20, parseInt(ans, 10) || 1));
  byId('printArea').innerHTML = '';
  const paper = byId('paper');
  paper.innerHTML = blankSheetHTML().repeat(n);
  paper.classList.remove('zoomed');
  forceA4();
  await new Promise(r => setTimeout(r, 200));
  window.print();
  afterPrint(true);
}
