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
