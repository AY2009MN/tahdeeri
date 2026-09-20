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
