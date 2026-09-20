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
