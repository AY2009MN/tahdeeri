/* ═══ لوحة «المزيد» ═══
   على الشاشات الضيّقة لا يتّسع شريط المحرّر لأدواته كلّها ، فتُطوى الأدوات
   الثانوية (المعلّمة بـ class="foldable") وتُعرض في لوحة تنزلق من أسفل الشاشة.

   اللوحة تنقل العناصر نفسها لا نسخاً عنها ، ثم تعيدها إلى مواضعها عند الإغلاق.
   بهذا تبقى الأحداث المربوطة بها سليمة ، وتعمل القوائم المنسدلة وخانات الاختيار
   وحقول الملفّات كما هي ـ بلا منطق مكرَّر في مكانين. */

const MORE = { moved: [] };

function morePanelOpen() {
  const pane = byId('morePane');
  pane.innerHTML = '';
  MORE.moved = $$('#editorBar .foldable').map(el => {
    const mark = document.createComment('foldable');
    el.before(mark);
    const row = document.createElement('div');
    row.className = 'more-row';
    const title = el.dataset.more;
    if (title && !el.querySelector('select')) row.dataset.label = '';
    else if (title) row.innerHTML = `<span class="more-lbl">${esc(title)}</span>`;
    row.appendChild(el);
    pane.appendChild(row);
    return { el, mark };
  });
  byId('morePop').classList.add('open');
}

function morePanelClose() {
  if (!byId('morePop').classList.contains('open')) return;
  for (const { el, mark } of MORE.moved) {
    mark.replaceWith(el);
  }
  MORE.moved = [];
  byId('morePane').innerHTML = '';
  byId('morePop').classList.remove('open');
}

function wireMorePanel() {
  bind('btnMore', 'onclick', morePanelOpen);
  byId('morePop').addEventListener('click', e => {
    if (e.target.closest('.veil') || e.target.closest('[data-moreclose]')) return morePanelClose();
    // زرّ أمر داخل اللوحة : ينفّذ ثمّ تُغلق اللوحة ليرى المعلّم النتيجة
    const btn = e.target.closest('#morePane button, #morePane label.btn');
    if (btn && !btn.querySelector('select')) setTimeout(morePanelClose, 60);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') morePanelClose(); });
}

/* ═══ ربط شريط المحرّر والورقة ═══ */

/* ما يغيّر التحضير يمرّ بالقفل. الطباعة والتنقّل وتبديل العرض تبقى مفتوحةً
   دائماً ـ القفل يمنع التعديل لا التصفّح. */
const ifUnlocked = (fn, what) => async (...a) => {
  if (await lockAsk(what || 'هذا الإجراء')) return fn(...a);
};

/** «لم تُعطَ الحصة» : يسأل عن موعدها الجديد وينزاح ما بعدها */
async function askMoveSession() {
  const c = curClass(), s = curSession();
  if (!c || !s) return;
  const next = (classDates[c.id] || []).slice(curIdx + 1).find(d => d)?.date;
  const ans = prompt(
    `${s.code} ${s.title} ـ الحصة ${ar(s.partIdx)}\n` +
    `موعدها الآن : ${s.date || '—'}\n\n` +
    'اكتب الموعد الجديد (سنة-شهر-يوم) ، ويُزاح ما بعدها تبعاً :',
    next || s.date || '');
  if (ans === null) return;
  const d = ans.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return alert('اكتب التاريخ هكذا : 2026-10-05');
  if (s.date && d <= s.date) return alert('الموعد الجديد يجب أن يكون بعد الموعد الحالي.');
  const err = await moveSession(c, curIdx, d);
  if (err) return alert(err);
  renderEditor();
}

/** أزرار التنقّل والقوائم والطباعة */
function wireEditorBar() {
  bind('unitSel', 'onchange', e => { curIdx = firstSessionWhere(s => s.unitNo === e.target.value); renderEditor(); });
  bind('lessonSel', 'onchange', e => { curIdx = firstSessionWhere(s => s.code === e.target.value); renderEditor(); });
  bind('partSel', 'onchange', e => { curIdx = +e.target.value; renderEditor(); });
  bind('btnToday', 'onclick', () => openToday());
  bind('btnDate', 'onclick', ifUnlocked(askMoveSession, 'تأجيل الحصة'));
  bind('btnClearMoves', 'onclick', ifUnlocked(async () => {
    const c = curClass();
    if (!c || !(c.gaps || []).length) return alert('لا تأجيلات على هذه الشعبة.');
    if (!confirm(`إلغاء ${ar((c.gaps || []).length)} تأجيلاً وإعادة التوزيع من أوّل الفصل؟`)) return;
    await clearMoves(c);
  }, 'إلغاء التأجيلات'));
  bind('prevSes', 'onclick', () => gotoSession(-1));
  bind('nextSes', 'onclick', () => gotoSession(1));
  bind('btnFit', 'onclick', ifUnlocked(fitToPages, 'ضبط الصفحتين'));
  bind('btnPrint', 'onclick', () => printCurrent('sheet'));
  bind('btnBlank', 'onclick', printBlank);
  bind('btnReset', 'onclick', ifUnlocked(resetSession, 'استعادة الأصل'));
  bind('btnWorksheet', 'onclick', () => printCurrent('worksheet'));
  bind('btnPrintWeek', 'onclick', printWeekSessions);
  bind('btnStudio', 'onclick', ifUnlocked(() => openStudio('gallery'), 'استوديو الكتاب'));
  // قصٌّ مباشر : يفتح العارض على صفحات درس الحصة نفسها ، فأداة الإطار جاهزة
  bind('btnCut', 'onclick', ifUnlocked(() => openStudio('pdf'), 'القصّ من الكتاب'));
  bind('btnViewMode', 'onclick', toggleViewMode);
  bind('imgFile', 'onchange', e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) ifUnlocked(insertImage, 'إدراج صورة')(f);
  });
  bind('fsSel', 'onchange', e => { S.fontSize = +e.target.value; DB.put('settings', S); renderEditor(); });
}

/** «عدم طباعة التاريخ والصف» ـ خانتان مترابطتان في الشريط والإعدادات */
function wireManualMeta() {
  const update = val => {
    S.manualMeta = !!val;
    const a = byId('chkManualMeta'), b = byId('stManualMeta');
    if (a) a.checked = S.manualMeta;
    if (b) b.checked = S.manualMeta;
    DB.put('settings', S);
    if (!byId('view-editor').classList.contains('hidden')) renderEditor();
  };
  ['chkManualMeta', 'stManualMeta'].forEach(id => {
    const el = byId(id);
    if (!el) return;
    el.checked = !!S.manualMeta;
    el.onchange = () => update(el.checked);
  });
}

/** ضبط ارتفاع الصناديق وحذف صور الأقسام ـ نقرات داخل الورقة */
function wirePaperControls() {
  const paper = byId('paper');
  paper.addEventListener('click', e => {
    const hb = e.target.closest('[data-hd]');
    if (hb) {
      e.preventDefault(); e.stopPropagation();
      const ses = curSession(), p = prepFor(ses);
      const f = hb.dataset.hf;
      p.lines = { ...(p.lines || {}) };
      p.lines[f] = Math.max(1, Math.min(4, (p.lines[f] || 1) + (+hb.dataset.hd)));
      markDirty(ses);
      return renderEditor();
    }
    const db = e.target.closest('[data-delfig]');
    if (db) {
      const ses = curSession(), p = prepFor(ses);
      p.figs = (p.figs !== undefined ? p.figs : (ses.figs || []))
        .filter((_, i) => i !== +db.dataset.delfig);
      markDirty(ses);
      renderEditor();
    }
  });
  paper.addEventListener('focusout', e => {
    if (e.target.closest?.('[contenteditable][data-f]')) checkOverflow();
  });
}

/** شريط تنسيق النصّ */
function wireFormatBar() {
  const fmt = byId('fmtBar');
  fmt.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  fmt.addEventListener('click', e => {
    const b = e.target.closest('[data-cmd]');
    if (!b) return;
    const box = document.activeElement?.closest('#paper [contenteditable][data-f]');
    if (!box) return alert('انقر أولاً داخل المقدمة أو العرض أو الخاتمة أو التقويم.');
    const [cmd, val] = b.dataset.cmd.split(':');
    if (cmd === 'hilite') document.execCommand('hiliteColor', false, val);
    else if (cmd === 'bullet') document.execCommand('insertText', false, '• ');
    else document.execCommand(cmd, false, val || null);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function wireEditor() {
  wireEditorBar();
  wireManualMeta();
  wirePaperControls();
  wireFormatBar();
  wireMorePanel();
}

/* ═══ ربط شاشة الإعدادات ═══ */

function wireSettingsFields() {
  ['stTeacher', 'stSchool', 'stYear', 'stTerm', 'stStart', 'stEnd'].forEach(id => {
    bind(id, 'onchange', async e => {
      S[id.replace('st', '').toLowerCase()] = e.target.value;
      await DB.put('settings', S);
      if (id === 'stStart' || id === 'stEnd') await regenerateAll('أُعيد التوزيع');
    });
  });

  byId('sectionsBox').addEventListener('change', e => {
    const c = e.target.closest('[data-sec]');
    if (!c) return;
    S.sections[c.dataset.sec] = c.checked;
    DB.put('settings', S);
  });

  byId('viewModeBox').addEventListener('change', e => {
    if (e.target.name !== 'vmode') return;
    S.viewMode = e.target.value;
    DB.put('settings', S);
    applyViewMode();
  });
}

function wireTimetable() {
  const tt = byId('timetable');

  tt.addEventListener('change', e => {
    const sel = e.target.closest('[data-tt]'), nm = e.target.closest('[data-cname]');
    if (sel) {
      const c = S.classes.find(x => x.id === sel.dataset.tt), d = +sel.dataset.d;
      c.tt = (c.tt || []).filter(x => x.d !== d);
      if (sel.value) c.tt.push({ d, p: +sel.value });
    } else if (nm) {
      const c = S.classes.find(x => x.id === nm.dataset.cname);
      c.name = nm.value.trim() || c.name;
      fillClassSel();
    } else return;
    regenerateAll('أُعيد التوزيع بعد تعديل الجدول');
  });

  tt.addEventListener('click', e => {
    const del = e.target.closest('[data-cdel]');
    if (del) {
      if (S.classes.length < 2 || !confirm('حذف هذه الشعبة وجدولها؟ (التحضير نفسه لا يُحذف)')) return;
      S.classes = S.classes.filter(c => c.id !== del.dataset.cdel);
      if (!S.classes.some(c => c.id === S.cls)) S.cls = S.classes[0].id;
    } else if (e.target.id === 'addCls') {
      const g = byId('newClsGrade').value, name = byId('newClsName').value.trim();
      if (!name) return alert('اكتب اسم الشعبة، مثل ٨/٢');
      S.classes.push({ id: 'c' + g + '_' + Date.now().toString(36), g, name, tt: [] });
    } else return;
    fillClassSel();
    renderSettings();
    regenerateAll('أُعيد التوزيع بعد تعديل الشعب');
  });
}

function wireHolidays() {
  bind('addHol', 'onclick', () => {
    const d = byId('holDate').value;
    if (!d) return;
    S.holidays.push({ date: d, label: byId('holLabel').value || 'عطلة' });
    byId('holLabel').value = '';
    renderSettings();
    regenerateAll('أُعيد التوزيع بعد إضافة العطلة');
  });
  byId('holList').addEventListener('click', e => {
    const hb = e.target.closest('[data-hol]');
    if (!hb) return;
    S.holidays.splice(+hb.dataset.hol, 1);
    renderSettings();
    regenerateAll('أُعيد التوزيع بعد حذف العطلة');
  });
  bind('btnGenerate', 'onclick', () => regenerateAll());
}

function wireTransfer() {
  const exportAll = async withBooks => {
    const data = await DB.dump(withBooks);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    a.download = `دفتر_التحضير_${todayISO()}${withBooks ? '_مع_الكتب' : ''}.daftar`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  bind('btnExport', 'onclick', () => exportAll(false));
  bind('btnExportBooks', 'onclick', () => exportAll(true));
  /* الاستيراد يفحص المحتوى لا الامتداد : لاحقة .daftar مجهولة عند الأجهزة ،
     فلو قيّدنا المنتقي بها لظهر ملفّ النسخة باهتاً على التاب فتعذّر اختياره. */
  bind('impFile', 'onchange', async e => {
    const f = e.target.files[0];
    if (!f) return;
    e.target.value = '';
    let data;
    try { data = JSON.parse(await f.text()); }
    catch { return alert(`تعذّرت قراءة «${f.name}».\n\nاختر ملف النسخة الاحتياطية الصادر من التطبيق (ينتهي بـ .daftar أو .json).`); }
    if (data.app !== 'daftar-tahdeer')
      return alert(`«${f.name}» ليس ملف نسخة من دفتر التحضير.`);
    const when = (data.syncedAt || data.exportedAt || '').slice(0, 16).replace('T', ' ');
    const n = (data.preps || []).length;
    if (!confirm(`استيراد النسخة${when ? ' (' + when + ')' : ''} : ${ar(n)} تحضيراً.\n\n` +
                 'سيُستبدل كلّ ما على هذا الجهاز. متابعة؟')) return;
    await DB.restore(data);
    location.reload();
  });
}

function wireSettings() {
  wireSettingsFields();
  wireTimetable();
  wireHolidays();
  wireTransfer();
}
