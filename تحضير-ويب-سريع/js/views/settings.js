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
