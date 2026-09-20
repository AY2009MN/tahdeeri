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
