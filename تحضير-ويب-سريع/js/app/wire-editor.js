/* ═══ ربط شريط المحرّر والورقة ═══ */

/* ما يغيّر التحضير يمرّ بالقفل. الطباعة والتنقّل وتبديل العرض تبقى مفتوحةً
   دائماً ـ القفل يمنع التعديل لا التصفّح. */
const ifUnlocked = fn => (...a) => LOCK.open
  ? fn(...a)
  : alert('التعديل مقفل ـ افتح القفل بالرقم السرّي أوّلاً.');

/** أزرار التنقّل والقوائم والطباعة */
function wireEditorBar() {
  bind('unitSel', 'onchange', e => { curIdx = firstSessionWhere(s => s.unitNo === e.target.value); renderEditor(); });
  bind('lessonSel', 'onchange', e => { curIdx = firstSessionWhere(s => s.code === e.target.value); renderEditor(); });
  bind('partSel', 'onchange', e => { curIdx = +e.target.value; renderEditor(); });
  bind('btnToday', 'onclick', () => openToday());
  bind('prevSes', 'onclick', () => gotoSession(-1));
  bind('nextSes', 'onclick', () => gotoSession(1));
  bind('btnFit', 'onclick', ifUnlocked(fitToPages));
  bind('btnPrint', 'onclick', () => printCurrent('sheet'));
  bind('btnBlank', 'onclick', printBlank);
  bind('btnReset', 'onclick', ifUnlocked(resetSession));
  bind('btnWorksheet', 'onclick', () => printCurrent('worksheet'));
  bind('btnPrintWeek', 'onclick', printWeekSessions);
  bind('btnStudio', 'onclick', ifUnlocked(() => openStudio('gallery')));
  bind('btnViewMode', 'onclick', toggleViewMode);
  bind('imgFile', 'onchange', e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) ifUnlocked(insertImage)(f);
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
