/* ═══ إدارة صور الورقة ═══
   جرد كامل لكلّ صورة أُدرجت في التحضير الحالي ، مع اسم قسمها وحجمها ،
   وأزرار للتحكّم بها من مكان واحد ـ أنفع ما يكون على الهاتف حيث يصعب
   الإمساك بالمقابض الصغيرة فوق الصورة نفسها. */

const sectionNameOf = el => {
  const f = el.closest('[contenteditable][data-f]')?.dataset.f;
  return (SLOTS.find(x => x.k === f) || {}).t || 'قسم غير معروف';
};

/** كل صور الورقة مرقّمة بترتيب ظهورها */
function myImages() {
  return inlAll().map((sp, i) => ({
    i, sp,
    src: sp.querySelector('img')?.src || '',
    w: +sp.dataset.w || 90,
    sec: sectionNameOf(sp),
    free: sp.classList.contains('free')
  }));
}

const mgBtn = (i, act, label, title) =>
  `<button data-mg="${act}" data-mgi="${i}" title="${title}" aria-label="${title}">${label}</button>`;

function myImageRow(it) {
  return `<div class="st-item">
    <img src="${esc(it.src)}" alt="">
    <div class="info">
      <b>${esc(it.sec)}</b>
      <span>العرض ${ar(it.w)}٪${it.free ? ' · وضع حرّ' : ''}</span>
    </div>
    <div class="acts">
      ${mgBtn(it.i, 'w:-10', '−', 'تصغير')}
      ${mgBtn(it.i, 'w:10', '+', 'تكبير')}
      ${mgBtn(it.i, 'al:r', '⇥', 'محاذاة يمين')}
      ${mgBtn(it.i, 'al:c', '≡', 'توسيط')}
      ${mgBtn(it.i, 'al:l', '⇤', 'محاذاة يسار')}
      ${mgBtn(it.i, 'up', '▲', 'نقل للأعلى')}
      ${mgBtn(it.i, 'down', '▼', 'نقل للأسفل')}
      ${mgBtn(it.i, 'crop', '✂', 'اقتصاص')}
      ${mgBtn(it.i, 'clean', '▨', 'تفريغ الخلفية')}
      ${mgBtn(it.i, 'goto', '🔎', 'إظهارها في الورقة')}
      ${mgBtn(it.i, 'del', '🗑', 'حذف')}
    </div>
  </div>`;
}

function renderMyImages() {
  const list = myImages();
  byId('stList').innerHTML = list.length
    ? `<p class="hint" style="color:#b9cbdd;margin:0 0 10px">${
         ar(list.length)} صورة في هذا التحضير ـ تحكّم بها من هنا بلا حاجة إلى تكبير الورقة.</p>`
       + list.map(myImageRow).join('')
    : `<p class="st-empty">لا صور في هذه الورقة بعد.<br>
        افتح «معرض الدرس» وأدرج ما تحتاجه بنقرة واحدة.</p>`;
}

function wireMyImages(v) {
  v.addEventListener('click', async e => {
    const b = e.target.closest('[data-mg]');
    if (!b) return;
    const it = myImages()[+b.dataset.mgi];
    if (!it) return renderMyImages();
    const [a, val] = b.dataset.mg.split(':');

    if (a === 'goto') {
      if (!isWide()) closeStudio();
      inlSelect(it.sp);
      it.sp.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (a === 'del') {
      if (!confirm('حذف هذه الصورة من ورقة التحضير؟')) return;
      inlRemove(it.sp);
      return renderMyImages();
    }
    if (a === 'crop') {
      if (!isWide()) closeStudio();
      return inlCrop(it.sp);
    }
    b.disabled = true;
    await inlAction(a, val, it.sp, b);
    b.disabled = false;
    inlSave(it.sp);
    renderMyImages();
  });
}
