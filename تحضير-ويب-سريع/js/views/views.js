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

/* ═══ مكتبة الكتب ═══
   كتاب الطالب ودليل المعلّم وأيّ ملف PDF يحتاجه المعلّم أثناء التحضير.
   دور الملف يحدّد أيّ كتاب يفتحه الاستوديو تلقائياً لكل صف. */

const ROLES = {
  s8: 'كتاب الطالب ـ الثامن', s9: 'كتاب الطالب ـ التاسع',
  g8: 'دليل المعلّم ـ الثامن', g9: 'دليل المعلّم ـ التاسع', other: 'ملف آخر'
};

function bookCard(b) {
  return `<div class="bookcard">
    <b>${esc(b.name)}</b>
    <small>${ar(Math.max(1, Math.round(b.size / 1048576)))} م.ب · أُضيف ${fmtDate(b.added)}</small>
    <label class="rowlbl">دوره
      <select data-role="${esc(b.id)}" aria-label="دور الملف">
        ${Object.entries(ROLES).map(([k, t]) =>
          `<option value="${k}"${b.role === k ? ' selected' : ''}>${t}</option>`).join('')}
      </select>
    </label>
    <div class="row">
      <button class="btn" data-openbook="${esc(b.id)}">تصفّح</button>
      <button class="btn" data-delbook="${esc(b.id)}">حذف</button>
    </div>
  </div>`;
}

async function renderLibrary() {
  const box = byId('bookList');
  if (!box) return;
  const rows = await DB.all('books');
  box.innerHTML = rows.length ? rows.map(bookCard).join('')
    : `<p class="hint">لم تُضف ملفات بعد. أضِف كتاب الطالب للصفين وحدّد دور كلّ ملف ،
       ليفتح الاستوديو على صفحات الدرس تلقائياً.<br>
       ولك غنى عن ذلك في الغالب : «معرض الدرس» في الاستوديو يحوي صور الكتاب مقصوصة مسبقاً.</p>`;
}

async function addBook(file) {
  if (!file || file.type !== 'application/pdf') return alert('الملف يجب أن يكون بصيغة PDF.');
  const name = file.name.replace(/\.pdf$/i, '');
  const role = /تاسع|9/.test(name) ? (/دليل/.test(name) ? 'g9' : 's9')
             : /ثامن|8/.test(name) ? (/دليل/.test(name) ? 'g8' : 's8') : 'other';
  await DB.put('books', { id: 'b' + Date.now(), name, size: file.size, role,
                          added: todayISO(), blob: file });
  renderLibrary();
  toast('أُضيف الملف إلى المكتبة ✓');
}

function wireLibrary() {
  const box = byId('bookList');
  box.addEventListener('change', async e => {
    const r = e.target.closest('[data-role]');
    if (!r) return;
    const rec = await DB.get('books', r.dataset.role);
    if (rec) { rec.role = r.value; await DB.put('books', rec); toast('حُفظ دور الملف ✓'); }
  });
  box.addEventListener('click', e => {
    const o = e.target.closest('[data-openbook]');
    if (o) { bk.id = o.dataset.openbook; openStudio('pdf'); return; }
    const d = e.target.closest('[data-delbook]');
    if (d && confirm('حذف هذا الملف من المكتبة؟'))
      DB.del('books', d.dataset.delbook).then(renderLibrary);
  });
  bind('bookFile', 'onchange', e => {
    const b = e.target.files[0];
    if (b) addBook(b);
    e.target.value = '';
  });
}

/* ═══ شاشة الإعدادات : الرسم ═══ (الربط في js/app/wire-settings.js) */

function classCard(c) {
  const del = S.classes.length > 1
    ? `<button class="btn sm" data-cdel="${c.id}">حذف الشعبة</button>` : '';
  const row = [0, 1, 2, 3, 4].map(d => {
    const slot = (c.tt || []).find(x => x.d === d);
    return `<td><select data-tt="${c.id}" data-d="${d}" aria-label="${DAYS[d]}">
        <option value="">—</option>
        ${[1, 2, 3, 4, 5, 6, 7].map(p =>
          `<option value="${p}"${slot && slot.p === p ? ' selected' : ''}>الحصة ${ar(p)}</option>`).join('')}
      </select></td>`;
  }).join('');
  return `<div class="nbunit">
    <h4 class="clshead">${esc(CURRICULA[c.g].name)} ـ الشعبة
      <input data-cname="${c.id}" value="${esc(c.name)}" aria-label="اسم الشعبة">${del}</h4>
    <div class="ttwrap"><table class="tttable">
      <tr>${DAYS.slice(0, 5).map(d => `<th>${d}</th>`).join('')}</tr>
      <tr>${row}</tr>
    </table></div>
  </div>`;
}

function renderTimetable() {
  byId('timetable').innerHTML = S.classes.map(classCard).join('') + `
    <div class="toolbar">
      <select id="newClsGrade" aria-label="صف الشعبة الجديدة">${Object.keys(CURRICULA).map(g =>
        `<option value="${g}">${esc(CURRICULA[g].name)}</option>`).join('')}</select>
      <input id="newClsName" placeholder="اسم الشعبة ـ مثل ٨/٢" style="width:170px">
      <button class="btn primary" id="addCls">＋ إضافة شعبة</button>
    </div>`;
}

function renderSections() {
  const box = byId('sectionsBox');
  if (!box) return;
  S.sections ||= { ...DEFAULTS.sections };
  box.innerHTML = Object.entries(SECTION_LABELS).map(([k, label]) =>
    `<label class="btn"><input type="checkbox" data-sec="${k}"${
      S.sections[k] !== false ? ' checked' : ''}> ${label}</label>`).join('');
}

function renderViewModePick() {
  const box = byId('viewModeBox');
  if (!box) return;
  const modes = [['auto', 'تلقائي ـ حسب الجهاز'], ['screen', 'وضع الشاشة ـ كتابة مريحة'],
                 ['a4', 'مقاس A4 ـ كما يُطبع']];
  box.innerHTML = modes.map(([k, t]) =>
    `<label class="btn"><input type="radio" name="vmode" value="${k}"${
      (S.viewMode || 'auto') === k ? ' checked' : ''}> ${t}</label>`).join('');
}

function renderSettings() {
  ['Teacher', 'School', 'Year', 'Term', 'Start', 'End'].forEach(k =>
    setVal('st' + k, S[k.toLowerCase()]));
  renderTimetable();
  renderSections();
  renderViewModePick();
  const man = byId('stManualMeta');
  if (man) man.checked = !!S.manualMeta;
  byId('holList').innerHTML = S.holidays.map((h, i) =>
    `<li>${fmtDate(h.date)} ـ ${esc(h.label || 'عطلة')}
       <button data-hol="${i}" title="حذف" aria-label="حذف العطلة">×</button></li>`).join('')
    || '<li class="hint">لا عطل مضافة.</li>';
}
