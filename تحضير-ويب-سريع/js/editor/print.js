/* ═══ الطباعة ═══
   تُطبع ورقة الشاشة نفسها ، ويفرض css/print.css مقاس A4 الحقيقي مهما كان
   وضع العرض ، فتخرج الطباعة مطابقة في الهاتف والحاسوب معاً. */

/** يهيّئ الورقة للطباعة : هندسة A4 حقيقية ، بلا تحديد ولا تصغير ، والصور محمّلة.
    فرض A4 هنا ضروريّ : في «وضع الشاشة» تتمدّد الصناديق بارتفاع محتواها ، فلو
    قِسنا الامتلاء عليها لظننّا كلّ شيء متّسعاً ثم خرجت الطباعة مقصوصة. */
async function preparePrint(paper) {
  figSel = null;
  inlDeselect();
  paper.classList.remove('zoomed');
  document.body.classList.remove('screenmode');
  document.body.classList.add('a4mode');
  await new Promise(r => setTimeout(r, 250));
  await Promise.all($$('img', paper).map(im => im.decode ? im.decode().catch(() => {}) : 0));
  // الضبط قبل الطباعة مباشرة : لا تخرج صورة مقصوصة لأنّ صندوقها امتلأ
  fitAllBoxes(false);
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
    await new Promise(r => setTimeout(r, 150));
    window.print();
    return afterPrint(true);
  }

  renderEditor();
  await preparePrint(paper);
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
  await preparePrint(paper);
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
  await new Promise(r => setTimeout(r, 200));
  window.print();
  afterPrint(true);
}
