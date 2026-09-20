/* ═══ توزيع تواريخ الحصص ═══
   لكل شعبة جدولها الأسبوعي ، فتوزَّع حصص صفّها على أيام الفصل بالترتيب ،
   مع تخطّي الجمعة والسبت والعطل. أيّ تعديل في التاريخ أو الجدول أو العطل
   يعيد التوزيع كاملاً فوراً ـ بلا حاجة إلى زرّ. */

function computeDates() {
  const hol = new Set(S.holidays.map(h => h.date));
  const startAll = parseISO(S.start), endAll = parseISO(S.end);
  const report = {};
  for (const c of S.classes) {
    const slots = (c.tt || []).slice().sort((a, b) => a.d - b.d || a.p - b.p);
    const total = sessionsIdx[c.g].length;
    const out = classDates[c.id] = [];
    const d = new Date(startAll);
    while (slots.length && out.length < total && d <= endAll) {
      const wd = d.getDay();
      if (wd !== 5 && wd !== 6 && !hol.has(iso(d)))
        for (const sl of slots.filter(x => x.d === wd)) {
          if (out.length >= total) break;
          out.push({ date: iso(d), period: sl.p });
        }
      d.setDate(d.getDate() + 1);
    }
    report[c.id] = out.length;
  }
  return report;
}

/** تطبيق تواريخ الشعبة المختارة على حصص صفّها */
function applyClass() {
  const c = curClass(); if (!c) return;
  grade = c.g;
  const ds = classDates[c.id] || [];
  sessionsIdx[c.g].forEach((x, i) => {
    x.date = ds[i] ? ds[i].date : null;
    x.period = ds[i] ? ds[i].period : null;
  });
}

const generateDates = () => { const r = computeDates(); applyClass(); return r; };

async function regenerateAll(msg) {
  const rep = generateDates();
  await persistSessions();
  await DB.put('settings', S);
  setText('genMsg', (msg ? msg + ' ـ ' : '') + S.classes
    .map(c => `${CURRICULA[c.g].name} ${c.name}: وُزّعت ${ar(rep[c.id] || 0)} حصة`).join(' · '));
  renderHome();
  if (!byId('view-editor').classList.contains('hidden')) renderEditor();
  return rep;
}

/** حصة اليوم إن وُجدت ، وإلّا أقرب حصة قادمة ، وإلّا آخر حصة مضت */
function todayIdx(gid) {
  const c = (S?.classes || []).find(x => x.id === S?.cls && x.g === gid)
         || (S?.classes || []).find(x => x.g === gid);
  const dates = c ? (classDates[c.id] || []) : [];
  const t = todayISO();
  if (dates.length) {
    const same = dates.findIndex(d => d && d.date === t);
    if (same >= 0) return same;
    const next = dates.findIndex(d => d && d.date > t);
    return next >= 0 ? next : dates.length - 1;
  }
  const list = sessionsIdx[gid] || [];
  const same = list.findIndex(s => s.date === t);
  if (same >= 0) return same;
  const next = list.findIndex(s => s.date && s.date > t);
  if (next >= 0) return next;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].date) return i;
  return 0;
}

/** يفتح تحضير اليوم ـ يبحث في شعب المعلّم كلّها مع تفضيل الشعبة الحالية */
function openToday(preferCurrent = true) {
  const t = todayISO(), cc = curClass();
  if (preferCurrent && cc) {
    const i = (classDates[cc.id] || []).findIndex(d => d && d.date === t);
    if (i >= 0) { openEditor(cc.g, i, cc.id); return true; }
  }
  for (const c of (S.classes || [])) {
    if (preferCurrent && cc && c.id === cc.id) continue;
    const i = (classDates[c.id] || []).findIndex(d => d && d.date === t);
    if (i >= 0) { openEditor(c.g, i, c.id); return true; }
  }
  curIdx = todayIdx(grade);
  show('editor');
  return false;
}

/** كل حصص الشعب في مدى تواريخ ـ تُستعمل في الرئيسية وطباعة الأسبوع */
function sessionsInDates(dateList) {
  const want = new Set(dateList);
  const out = [];
  for (const c of S.classes)
    (classDates[c.id] || []).forEach((d, i) => {
      if (d && want.has(d.date) && sessionsIdx[c.g][i])
        out.push({ c, s: sessionsIdx[c.g][i], date: d.date, period: d.period, idx: i });
    });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);
}
