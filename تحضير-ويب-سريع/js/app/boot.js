/* ═══ إقلاع التطبيق ═══
   ترتيب الإقلاع : المنهج ← الإعدادات ← الحصص ← التواريخ ← الربط ← فتح اليوم. */

/** ترحيل الإعدادات القديمة إلى الشكل الحالي */
async function migrateSettings() {
  S.timetable ||= DEFAULTS.timetable;
  S.holidays ||= [];
  S.viewMode ||= DEFAULTS.viewMode;
  if ((S.ttVersion || 0) < DEFAULTS.ttVersion) {      // جدول هذا العام يستبدل أيّ جدول قديم
    S.timetable = JSON.parse(JSON.stringify(DEFAULTS.timetable));
    S.start = DEFAULTS.start;
    S.ttVersion = DEFAULTS.ttVersion;
  }
  await DB.put('settings', S);
}

/** الجدول القديم (صف واحد لكل مستوى) يصبح شعبة لكل صف */
async function migrateClasses() {
  if (Array.isArray(S.classes) && S.classes.length) return;
  S.classes = Object.keys(CURRICULA).map(g => ({
    id: 'c' + g + '_1', g, name: CURRICULA[g].section,
    tt: JSON.parse(JSON.stringify((S.timetable || DEFAULTS.timetable)[g] || []))
  }));
  S.cls = (S.classes.find(c => c.g === grade) || S.classes[0]).id;
  await DB.put('settings', S);
}

function fillClassSel() {
  const gs = byId('gradeSel');
  gs.innerHTML = S.classes.map(c =>
    `<option value="${c.id}">${esc(CURRICULA[c.g].name)} ـ ${esc(c.name)}</option>`).join('');
  gs.value = curClass().id;
}

/** التنقّل بين العروض واختيار الشعبة */
function wireShell() {
  $$('.tab').forEach(t => t.onclick = () => {
    if (t.dataset.view === 'editor' && byId('view-editor').classList.contains('hidden'))
      curIdx = todayIdx(grade);
    show(t.dataset.view);
  });
  bind('gradeSel', 'onchange', e => {
    S.cls = e.target.value;
    applyClass();
    curIdx = todayIdx(grade);
    DB.put('settings', S);
    show($('.view:not(.hidden)').id.replace('view-', ''));
  });
  document.body.addEventListener('click', e => {
    const row = e.target.closest('[data-g][data-i]');
    if (row) openEditor(row.dataset.g, +row.dataset.i, row.dataset.c);
  });
  bind('nbSearch', 'oninput', renderNotebook);
  bind('nbFilter', 'onchange', renderNotebook);
}

/** حارس فقدان العمل حين يتعذّر الحفظ الدائم */
function wireSaveGuard() {
  window.addEventListener('beforeunload', e => {
    if (!DB.noStore || unsaved <= 0) return;
    e.preventDefault(); e.returnValue = '';
    setTimeout(() => { if (!document.hidden) showSaveBar(); }, 60);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && DB.noStore && unsaved > 0) showSaveBar();
  });
}

function showSaveBar() {
  if ($('.banner.savebar')) return;
  banner(`<b>عملك لم يُحفظ بعد.</b> اختر قبل الإغلاق:
     <div class="banner-actions">
       <button class="btn primary" id="bSaveFile">حفظ عملي في ملف</button>
       <button class="btn" id="bSaveDraft">حفظ مسودة مؤقتة</button>
       <button class="btn" id="bNoSave">متابعة بلا حفظ</button>
     </div>`, 'warn savebar');
  bind('bSaveFile', 'onclick', () => saveToFile('نسخة'));
  bind('bSaveDraft', 'onclick', () => saveToFile('مسودة'));
  bind('bNoSave', 'onclick', e => { unsaved = 0; e.target.closest('.banner').remove(); });
}

function noStoreBanner() {
  if (!DB.noStore) return;
  const b = banner(`<b>بلا حفظ دائم.</b> فتحتَ الملف مباشرة ، فما تكتبه يبقى في الذاكرة فقط.
     للحفظ الدائم شغّل <code>تشغيل التطبيق.cmd</code> أو افتح نسخة الويب.
     <button class="bx" title="إخفاء">×</button>`, 'warn slim');
  b.querySelector('.bx').onclick = () => b.remove();
  setTimeout(() => b.remove(), 12000);
}

async function start() {
  for (const gid of Object.keys(CURRICULA)) sessionsIdx[gid] = flatten(gid);
  S = (await DB.get('settings', 'app')) || { ...DEFAULTS };
  await migrateSettings();
  (await DB.all('preps')).forEach(p => prepCache[p.id] = p);
  await loadSessions();
  await migrateClasses();

  computeDates();
  applyClass();
  curIdx = todayIdx(grade);
  fillClassSel();

  wireShell();
  wireEditor();
  wireSettings();
  wireLibrary();
  wireSaveGuard();
  await initLock();
  wireSync();
  applyViewMode();

  if ('serviceWorker' in navigator && location.protocol !== 'file:')
    navigator.serviceWorker.register('sw.js').catch(() => {});

  openToday();            // يفتح على تحضير اليوم ، أو أقرب حصة قادمة
  noStoreBanner();
}

(async function boot() {
  try { await start(); }
  catch (err) {
    console.error(err);
    // إصلاح ذاتي : خطأ عند الإقلاع غالباً سببه نسخة قديمة مخزّنة ـ نمسحها ونعيد التحميل مرّة
    let healed = false;
    try {
      healed = sessionStorage.getItem('daftar_healed') === '1';
      sessionStorage.setItem('daftar_healed', '1');
    } catch {}
    if (!healed && 'serviceWorker' in navigator) {
      try {
        for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        for (const k of await caches.keys()) await caches.delete(k);
      } catch {}
      return location.reload();
    }
    banner(`<b>تعذّر تشغيل التطبيق.</b><br>${esc(err.message || err)}`, 'err');
  }
})();
