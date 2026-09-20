/* ═══ استوديو التحضير : الهيكل والتنقّل ═══
   لوحة واحدة فيها ثلاثة ألسنة :
     gallery  معرض صور الدرس المقصوصة مسبقاً ـ نقرة واحدة للإدراج.
     pdf      صفحات كتاب الطالب مع القصّ المنتظم أو الحرّ.
     mine     إدارة الصور التي أُدرجت فعلاً في الورقة.
   الهدف (أين تُدرج الصورة) يظهر دائماً في أعلى اللوحة ويمكن تغييره باليد. */

const ST = { tab: 'gallery', open: false };

/* مواضع الإدراج المتاحة في ورقة التحضير */
const SLOTS = [
  { k: 'intro', t: 'المقدمة والتمهيد' },
  { k: 'show', t: 'العرض ـ صفحة ١' },
  { k: 'show2', t: 'تابع العرض ـ صفحة ٢' },
  { k: 'evalx', t: 'التقويم' }
];

function openStudio(tab) {
  wireStudio();
  ST.open = true;
  byId('studio').classList.remove('hidden');
  document.body.classList.add('studio-open');
  applyViewMode();          // عرض الورقة تقلّص بإرساء اللوحة ، فيُعاد حساب التصغير
  studioTab(tab || ST.tab);
}

function closeStudio() {
  ST.open = false;
  byId('studio').classList.add('hidden');
  document.body.classList.remove('studio-open');
  applyViewMode();
}

/** يبدّل اللسان الظاهر ويحمّل محتواه عند الحاجة */
function studioTab(tab) {
  ST.tab = tab;
  $$('#studio [data-sttab]').forEach(b => b.classList.toggle('on', b.dataset.sttab === tab));
  ['gallery', 'pdf', 'mine'].forEach(k => {
    byId('stPane' + k[0].toUpperCase() + k.slice(1))?.classList.toggle('on', k === tab);
    byId('stBar' + k[0].toUpperCase() + k.slice(1))?.classList.toggle('hidden', k !== tab);
  });
  byId('studio').classList.toggle('capturing', tab === 'pdf');
  studioHead();
  if (tab === 'gallery') renderGallery();
  if (tab === 'pdf') openBookPages();
  if (tab === 'mine') renderMyImages();
}

/** يعيد رسم اللسان الظاهر إن كانت اللوحة مفتوحة (بعد تغيّر الورقة) */
function studioRefreshIfOpen() {
  if (!ST.open) return;
  studioHead();
  if (ST.tab === 'gallery') renderGallery();
  if (ST.tab === 'mine') renderMyImages();
}

/** شريط العنوان وشريط الهدف */
function studioHead() {
  const s = curSession();
  if (!s) return;
  setText('stTitle', `${s.code} ${s.title} — استوديو التحضير`);

  const tgt = inlTargetName();
  const opts = SLOTS.map(x => `<option value="${x.k}">${x.t}</option>`).join('');
  byId('stTarget').innerHTML = tgt
    ? `تُدرج الصورة في: <b>${esc(tgt)}</b>`
    : `اختر موضع الإدراج: <select id="stSlot">${opts}</select>` +
      `<button class="btn sm primary" id="stSlotOk">تثبيت</button>`;
}

function wireStudioHead(v) {
  v.addEventListener('click', e => {
    const t = e.target.closest('[data-sttab]');
    if (t) return studioTab(t.dataset.sttab);
    if (e.target.closest('#stClose')) return closeStudio();
    if (e.target.closest('#stSlotOk')) {
      const f = byId('stSlot').value;
      if (inlSetTarget(f)) { studioHead(); toast('ثُبّت موضع الإدراج ✓'); }
      else alert('افتح ورقة التحضير أوّلاً.');
    }
  });
}

function wireStudio() {
  const v = byId('studio');
  if (!v || v.dataset.wired) return;
  v.dataset.wired = '1';
  wireStudioHead(v);
  wireGallery(v);
  wireBookPages(v);
  wireCapture(v);
  wireMyImages(v);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && ST.open && !$('.cropov')) closeStudio();
  });
}

/** يدرج صورة في الهدف ، ويغلق اللوحة على الشاشات الضيّقة ليرى المعلّم النتيجة */
async function studioInsert(dataUrl) {
  if (!inlTarget()) {
    alert('اختر موضع الإدراج من أعلى اللوحة أوّلاً.');
    return false;
  }
  await insertInline(dataUrl);
  if (!isWide()) closeStudio();
  toast('أُدرجت الصورة ✓');
  return true;
}
