/* ═══ تبديل العروض + الرئيسية + الدفتر ═══ */

const RENDERERS = {
  home: () => renderHome(),
  notebook: () => renderNotebook(),
  settings: () => renderSettings(),
  library: () => renderLibrary(),
  editor: () => renderEditor()
};

function show(view) {
  $$('.view').forEach(v => v.classList.add('hidden'));
  byId('view-' + view).classList.remove('hidden');
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  RENDERERS[view]?.();
  window.scrollTo({ top: 0 });
}

/* ────────── الرئيسية ────────── */
function renderHome() {
  const today = new Date(), t = iso(today);
  setText('todayGreg', `${DAYS[today.getDay()]} ${ar(today.getDate())}/${ar(today.getMonth() + 1)}/${ar(today.getFullYear())}`);
  setText('todayLabel', S.teacher ? `أهلاً ${S.teacher}` : 'مرحباً بك');

  const attrs = x => `data-g="${x.s.gradeId}" data-i="${x.s.n}" data-c="${x.c.id}"`;
  const todays = sessionsInDates([t]);
  byId('todaySessions').innerHTML = todays.length
    ? todays.map(x => `<div class="card ${isDone(x.s) ? 'done' : ''}" ${attrs(x)}>
         <b>${esc(x.s.gradeName)} ${esc(x.c.name)} ـ الحصة ${ar(x.period || 0)}</b>
         <small>${esc(x.s.code)} ${esc(x.s.title)}</small>
         <small>${esc(x.s.focus)}</small></div>`).join('')
    : '<p class="hint">لا توجد حصص اليوم.</p>';

  const rows = sessionsInDates(weekOf(today));
  byId('weekList').innerHTML = rows.length
    ? rows.map(x => `<div class="wrow" ${attrs(x)}>
        <span class="d">${fmtDate(x.date).split(' ')[0]} ${ar(parseISO(x.date).getDate())}</span>
        <span class="t">${esc(x.s.gradeName)} ${esc(x.c.name)} · الحصة ${ar(x.period)} · ${esc(x.s.code)} ${esc(x.s.title)}</span>
        <span class="s">${isDone(x.s) ? 'محضَّرة' : '—'}</span></div>`).join('')
    : '<p class="hint">لا حصص هذا الأسبوع.</p>';
  refreshStats();
}

function refreshStats() {
  const list = sessions();
  setText('statTotal', ar(list.length));
  setText('statDone', ar(list.filter(isDone).length));
}

/* ────────── الدفتر ────────── */
function notebookRow(s, today) {
  const isToday = s.date === today;
  return `<div class="nbrow ${isDone(s) ? 'done' : ''} ${isToday ? 'today' : ''}"
       data-g="${s.gradeId}" data-i="${s.n}">
    <span class="n">${ar(s.n + 1)}</span>
    <span class="t">${esc(s.code)} ${esc(s.title)}
      <small style="color:var(--ink-3)">(${ar(s.partIdx)}/${ar(s.partOf)})</small>
      ${isToday ? '<span class="tag-today">اليوم</span>' : ''}</span>
    <span class="dt">${fmtDate(s.date)}</span>
  </div>`;
}

function renderNotebook() {
  const q = (byId('nbSearch').value || '').trim();
  const f = byId('nbFilter').value;
  const today = todayISO();
  const byUnit = {};
  sessions().forEach(s => {
    if (q && !(s.title + s.code + s.focus).includes(q)) return;
    if (f === 'done' && !isDone(s)) return;
    if (f === 'todo' && isDone(s)) return;
    (byUnit[s.unitNo] ||= { title: s.unitTitle, rows: [] }).rows.push(s);
  });
  byId('nbList').innerHTML = Object.entries(byUnit).map(([no, u]) =>
    `<div class="nbunit"><h4>الوحدة ${esc(no)} ـ ${esc(u.title)}</h4>
      ${u.rows.map(s => notebookRow(s, today)).join('')}</div>`).join('')
    || '<p class="hint">لا نتائج.</p>';
}
