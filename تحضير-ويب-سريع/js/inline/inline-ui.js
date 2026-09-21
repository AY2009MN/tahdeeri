/* ═══ الصورة المحدَّدة : الشريط ، المقابض ، الوضع الحرّ ═══ */

const INL_CORNERS = ['tl', 'tr', 'bl', 'br'];

const ib = (act, label, title, on) =>
  `<button data-ia="${act}" title="${title}" aria-label="${title}"${on ? ' class="on"' : ''}>${label}</button>`;

function inlBarHTML(sp) {
  const w = +sp.dataset.w || 90;
  const free = sp.classList.contains('free');
  const al = c => sp.classList.contains('al-' + c);
  return ib('w:-5', '−', 'تصغير') + `<span>${ar(w)}٪</span>` + ib('w:5', '+', 'تكبير') + '<i></i>'
    + ib('al:r', '⇥', 'يمين', al('r')) + ib('al:c', '≡', 'وسط', al('c')) + ib('al:l', '⇤', 'يسار', al('l'))
    + '<i></i>'
    + ib('half', '◫', 'نصف العرض ـ لوضع صورتين متجاورتين')
    + ib('crop', '✂', 'اقتصاص جزء من الصورة')
    + ib('clean', '▨', 'تفريغ الخلفية وقصّ الحواف') + '<i></i>'
    + ib('free', '✥', 'تحريك حرّ فوق باقي العناصر', free)
    + (free ? ib('z:1', '⤒', 'إلى الأمام') + ib('z:-1', '⤓', 'إلى الخلف') : '')
    + '<i></i>'
    + ib('up', '▲', 'نقل سطراً للأعلى') + ib('down', '▼', 'نقل سطراً للأسفل')
    + ib('del', '🗑', 'حذف');
}

function inlDeselect() {
  $$('.inlbar,.inlh').forEach(x => x.remove());
  $$('.inl.sel').forEach(x => x.classList.remove('sel'));
  INL.sel = null;
}

function inlSelect(sp) {
  inlDeselect();
  INL.sel = sp;
  sp.classList.add('sel');
  const bar = document.createElement('div');
  bar.className = 'inlbar no-print';
  bar.innerHTML = inlBarHTML(sp);
  sp.appendChild(bar);
  for (const c of INL_CORNERS) {
    const h = document.createElement('i');
    h.className = 'inlh no-print h-' + c;
    h.dataset.corner = c;
    h.title = 'اسحب لتغيير الحجم';
    sp.appendChild(h);
  }
}

/** الوضع الحرّ : الصورة تُنتزع من مجرى النصّ فتطفو فوقه وتتراكب بالطبقات */
function inlSetFree(sp, on) {
  const wrap = sp.closest('.sectwrap');
  if (on && wrap) {
    const r = sp.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    sp.classList.add('free');
    sp.dataset.x = Math.round(wr.right - r.right);      // المسافة من الحافة اليمنى
    sp.dataset.y = Math.round(r.top - wr.top);
    sp.dataset.z = sp.dataset.z || 10;
  } else {
    sp.classList.remove('free');
    delete sp.dataset.x; delete sp.dataset.y; delete sp.dataset.z;
  }
  inlApplyFree(sp);
}

function inlApplyFree(sp) {
  if (sp.classList.contains('free')) {
    sp.style.setProperty('--ix', (sp.dataset.x || 0) + 'px');
    sp.style.setProperty('--iy', (sp.dataset.y || 0) + 'px');
    sp.style.setProperty('--iz', sp.dataset.z || 10);
  } else {
    ['--ix', '--iy', '--iz'].forEach(v => sp.style.removeProperty(v));
  }
}

/** يعيد تطبيق الوضع الحرّ بعد إعادة رسم الورقة (القيم محفوظة في data-*) */
function inlRestoreFree(root) {
  $$('.inl.free', root || document).forEach(inlApplyFree);
}

/** حذف صورة مع تنظيف صفّها الفارغ */
function inlRemove(sp) {
  const row = sp.parentElement;
  /* الصندوق يُمسَك قبل النزع : حذف آخر صورة يُزيل صفّها ، فكان الحفظ يذهب
     إلى أوّل صندوق في الورقة لا إلى الذي تغيّر ـ فتعود الصورة عند العودة. */
  const box = sp.closest('.sectbox');
  sp.remove();
  if (row.classList.contains('inlrow') && !row.children.length) row.remove();
  INL.sel = null;
  inlSave(box || row);
}

/** تنفيذ أمر من شريط الصورة ـ يعيد true إن اكتفى بنفسه فلا يُعاد التحديد */
async function inlAction(a, v, sp, btn) {
  const setW = w => { sp.dataset.w = w; sp.style.width = w + '%'; };
  if (a === 'w') setW(Math.max(10, Math.min(100, (+sp.dataset.w || 90) + (+v))));
  if (a === 'al') { sp.classList.remove('al-r', 'al-c', 'al-l'); sp.classList.add('al-' + v); }
  if (a === 'half') setW(+sp.dataset.w > 50 ? 48 : 90);
  if (a === 'free') inlSetFree(sp, !sp.classList.contains('free'));
  if (a === 'z') { sp.dataset.z = Math.max(1, Math.min(99, (+sp.dataset.z || 10) + (+v))); inlApplyFree(sp); }
  if (a === 'crop') { inlCrop(sp); return true; }
  if (a === 'del') { inlRemove(sp); return true; }
  if (a === 'up' || a === 'down') {
    const row = sp.parentElement;
    const sib = a === 'up' ? row.previousElementSibling : row.nextElementSibling;
    if (sib) a === 'up' ? sib.before(row) : sib.after(row);
  }
  if (a === 'clean') {
    const img = sp.querySelector('img');
    btn.textContent = '…';
    try {
      const out = await cleanShot(img.src);
      if (img.dataset.asset) {
        ASSETS[img.dataset.asset] = out;
        await DB.put('assets', { id: img.dataset.asset, data: out });
      }
      img.src = out;
    } catch { alert('تعذّر تفريغ خلفية هذه الصورة.'); }
  }
  return false;
}
