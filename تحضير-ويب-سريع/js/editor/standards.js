/* ═══ بنك المعايير ومؤشرات الأداء ═══
   المعيار ومؤشرات الأداء خانتان قابلتان للكتابة أصلاً في الورقة ، وهذا البنك
   يضيف إليهما الإدراج بالاختيار : معايير الوحدة كلّها معروضةٌ في قائمة ، تنقر
   الواحد فيدخل الخانة ، وتنقره ثانيةً فيخرج. وما تكتبه أنت يُحفظ في البنك
   فيصير متاحاً لكلّ دروس الوحدة ، ولك أن تطبّق الخانة على حصص الوحدة جميعاً.

   مصدر البنك ثلاثة : ما في المنهج لحصص هذه الوحدة ، وما أضفتَه أنت (S.bank) ،
   وما كتبتَه في الحصة نفسها. والمفتاح «صف|وحدة» فلكلّ وحدةٍ بنكها. */

const STD = { f: 'standard' };                       // الخانة المفتوحة حالياً
const stdLabel = f => f === 'standard' ? 'المعيار' : 'مؤشرات الأداء';
const bankKey = () => { const s = curSession(); return s ? `${grade}|${s.unitNo}` : ''; };
const stdLines = t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean);

/** كلّ ما وَرَد في هذه الوحدة من منهج ومن إضافات المعلّم */
function bankOf(f) {
  const s = curSession(); if (!s) return [];
  const out = new Set();
  (sessionsIdx[grade] || []).forEach(x => {
    if (x.unitNo === s.unitNo) stdLines(x[f]).forEach(t => out.add(t));
  });
  ((S.bank || {})[bankKey()] || {})[f]?.forEach(t => out.add(t));
  return [...out];
}

/** الخانة المعروضة في الورقة ، وقيمتها الحالية */
const stdCell = f => $(`#paper [contenteditable][data-f="${f}"]`);
const stdValue = f => stdLines(stdCell(f)?.innerText);

/** يكتب القيمة في الخانة ويحفظها بالمسار المعتاد نفسه */
function stdSet(f, lines) {
  const cell = stdCell(f); if (!cell) return;
  cell.innerText = lines.join('\n');
  cell.dispatchEvent(new Event('input', { bubbles: true }));
  renderStdPanel();
}

function stdToggle(f, text) {
  const cur = stdValue(f);
  const i = cur.indexOf(text);
  stdSet(f, i < 0 ? cur.concat(text) : cur.filter((_, k) => k !== i));
}

/** يضيف بنداً جديداً إلى بنك الوحدة ثمّ يُدرجه */
async function stdAddNew(f) {
  const t = (prompt(`أضِف ${stdLabel(f)} جديداً إلى بنك هذه الوحدة:`) || '').trim();
  if (!t) return;
  S.bank = S.bank || {};
  const k = bankKey();
  S.bank[k] = S.bank[k] || {};
  S.bank[k][f] = [...new Set((S.bank[k][f] || []).concat(t))];
  await DB.put('settings', S);
  stdSet(f, stdValue(f).concat(t));
}

/** يحذف بنداً من البنك ـ لا يمسّ ما في المنهج */
async function stdDropFromBank(f, text) {
  const k = bankKey(), mine = ((S.bank || {})[k] || {})[f] || [];
  if (!mine.includes(text)) return alert('هذا البند من المنهج ـ يمكن إخراجه من الحصة لا حذفه من البنك.');
  S.bank[k][f] = mine.filter(x => x !== text);
  await DB.put('settings', S);
  renderStdPanel();
}

/** ينسخ خانة الحصة المفتوحة إلى كلّ حصص الوحدة */
async function stdApplyUnit(f) {
  const s = curSession(); if (!s) return;
  const list = (sessionsIdx[grade] || []).filter(x => x.unitNo === s.unitNo);
  if (!confirm(`نسخ «${stdLabel(f)}» إلى ${ar(list.length)} حصة في الوحدة ${s.unitNo}؟`)) return;
  const val = stdValue(f).join('\n');
  for (const x of list) { prepFor(x)[f] = val; await DB.put('preps', prepCache[x.id]); }
  toast(`طُبّق «${stdLabel(f)}» على ${ar(list.length)} حصة ✓`);
}

/* ═══ اللوحة ═══ */
function renderStdPanel() {
  const box = byId('stdPanel'); if (!box) return;
  const f = STD.f, on = stdValue(f), mine = ((S.bank || {})[bankKey()] || {})[f] || [];
  const rows = bankOf(f).map(t => `<li class="${on.includes(t) ? 'on' : ''}" data-t="${esc(t)}">
      <span class="tick">${on.includes(t) ? '✓' : '＋'}</span><span class="txt">${esc(t)}</span>
      ${mine.includes(t) ? '<button class="x" data-del="1" title="حذف من البنك">✕</button>' : ''}</li>`).join('');
  box.innerHTML = `
    <div class="std-head">
      <button class="btn sm ${f === 'standard' ? 'primary' : ''}" data-tab="standard">المعيار</button>
      <button class="btn sm ${f === 'indicators' ? 'primary' : ''}" data-tab="indicators">مؤشرات الأداء</button>
      <span class="spacer"></span>
      <button class="btn sm" id="stdClose">إغلاق</button>
    </div>
    <p class="std-hint">انقر البند ليدخل «${stdLabel(f)}» في هذه الحصة ، وانقره ثانيةً ليخرج.</p>
    <ul class="std-list">${rows || '<li class="empty">لا بنود في بنك هذه الوحدة بعد.</li>'}</ul>
    <div class="std-foot">
      <button class="btn sm" id="stdNew">＋ بند جديد</button>
      <button class="btn sm" id="stdAll">إدراج كلّ بنود الوحدة</button>
      <button class="btn sm" id="stdClear">تفريغ الخانة</button>
      <button class="btn sm primary" id="stdUnit">طبّق على حصص الوحدة</button>
    </div>`;
}

function openStdPanel() {
  if (!curSession()) return alert('افتح ورقة التحضير أوّلاً.');
  let box = byId('stdPanel');
  if (!box) {
    box = document.createElement('div');
    box.id = 'stdPanel'; box.className = 'stdpanel no-print';
    document.body.appendChild(box);
    box.addEventListener('click', async e => {
      const tab = e.target.closest('[data-tab]');
      if (tab) { STD.f = tab.dataset.tab; return renderStdPanel(); }
      if (e.target.id === 'stdClose') return closeStdPanel();
      if (e.target.id === 'stdNew') return stdAddNew(STD.f);
      if (e.target.id === 'stdAll') return stdSet(STD.f, bankOf(STD.f));
      if (e.target.id === 'stdClear') return stdSet(STD.f, []);
      if (e.target.id === 'stdUnit') return stdApplyUnit(STD.f);
      const li = e.target.closest('li[data-t]'); if (!li) return;
      if (e.target.dataset.del) return stdDropFromBank(STD.f, li.dataset.t);
      stdToggle(STD.f, li.dataset.t);
    });
  }
  box.classList.add('open');
  renderStdPanel();
}
const closeStdPanel = () => byId('stdPanel')?.classList.remove('open');

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeStdPanel();
});
