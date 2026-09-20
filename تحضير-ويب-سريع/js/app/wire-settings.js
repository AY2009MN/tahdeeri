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
  bind('impFile', 'onchange', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!confirm('سيُستبدل ما في هذا الجهاز بمحتوى الملف. متابعة؟')) return;
      await DB.restore(data);
      location.reload();
    } catch { alert('الملف غير صالح. اختر ملف .daftar أو .json صادراً من التطبيق.'); }
  });
}

function wireSettings() {
  wireSettingsFields();
  wireTimetable();
  wireHolidays();
  wireTransfer();
}
