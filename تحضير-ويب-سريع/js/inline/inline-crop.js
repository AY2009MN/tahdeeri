/* ═══ اقتصاص جزء من صورة مُدرجة ═══
   إطار يُسحب أو تُسحب أركانه فوق الصورة ، ثم يُحفظ الجزء المقتصّ أصلاً جديداً
   حتى لا تتأثّر بقيّة مواضع الصورة نفسها. */

function cropOverlayHTML(r) {
  return `<div class="cropbox" style="left:${r.left + r.width * 0.1}px;top:${r.top + r.height * 0.1}px;
      width:${r.width * 0.8}px;height:${r.height * 0.8}px">
      <i class="cr c-tl"></i><i class="cr c-tr"></i><i class="cr c-bl"></i><i class="cr c-br"></i>
    </div>
    <div class="cropbar">
      <span>اسحب الإطار أو أركانه لتحديد الجزء المطلوب</span>
      <button class="btn sm primary" data-cropok>اقتصاص</button>
      <button class="btn sm" data-cropno>إلغاء</button>
    </div>`;
}

/** يحرّك الإطار أو يغيّر مقاسه ضمن حدود الصورة */
function cropMove(box, mv, e, r) {
  const dx = e.clientX - mv.x, dy = e.clientY - mv.y;
  let { l, t, w, h } = mv;
  if (!mv.corner) { l += dx; t += dy; }
  else {
    if (mv.corner.includes('l')) { l += dx; w -= dx; } else { w += dx; }
    if (mv.corner.includes('t')) { t += dy; h -= dy; } else { h += dy; }
  }
  w = Math.max(20, Math.min(w, r.width));
  h = Math.max(20, Math.min(h, r.height));
  l = Math.min(Math.max(r.left, l), r.right - w);
  t = Math.min(Math.max(r.top, t), r.bottom - h);
  box.style.cssText = `left:${l}px;top:${t}px;width:${w}px;height:${h}px`;
}

/** يقصّ المنطقة المحدَّدة من الصورة الأصلية بدقّتها الكاملة */
function cropToDataURL(img, r, b) {
  const sx = img.naturalWidth / r.width, sy = img.naturalHeight / r.height;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(b.width * sx));
  c.height = Math.max(1, Math.round(b.height * sy));
  c.getContext('2d').drawImage(img,
    Math.round((b.left - r.left) * sx), Math.round((b.top - r.top) * sy),
    c.width, c.height, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

function inlCrop(sp) {
  const img = sp.querySelector('img');
  if (!img || !img.naturalWidth) return;
  const r = img.getBoundingClientRect();
  const ov = document.createElement('div');
  ov.className = 'cropov no-print';
  ov.innerHTML = cropOverlayHTML(r);
  document.body.appendChild(ov);

  const box = $('.cropbox', ov);
  let mv = null;

  ov.addEventListener('pointerdown', e => {
    const corner = e.target.closest('.cr');
    if (!corner && !e.target.closest('.cropbox')) return;
    e.preventDefault();
    const b = box.getBoundingClientRect();
    mv = { corner: corner ? corner.className.replace(/.*c-/, '') : null,
           x: e.clientX, y: e.clientY, l: b.left, t: b.top, w: b.width, h: b.height };
    try { ov.setPointerCapture(e.pointerId); } catch {}
  });
  ov.addEventListener('pointermove', e => { if (mv) cropMove(box, mv, e, r); });
  ov.addEventListener('pointerup', () => { mv = null; });

  ov.addEventListener('click', async e => {
    if (e.target.closest('[data-cropno]')) return ov.remove();
    if (!e.target.closest('[data-cropok]')) return;
    const out = cropToDataURL(img, r, box.getBoundingClientRect());
    const id = await putAsset(out);
    img.dataset.asset = id;
    img.src = out;
    ov.remove();
    inlSave(sp);
    toast('اقتُصّت الصورة ✓');
  });
}
