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

/* ═══ ربط تفاعل الصور داخل النصّ ═══ */

/* القفل يمنع الكتابة ، وعليه أن يمنع الصور مثلها : كان المقفل يُحدَّد فيه
   الصورة فيظهر شريطها فتُكبَّر أو تُحذف بلمسةٍ عابرة. */
const inlLocked = () => typeof LOCK !== 'undefined' && !LOCK.open;

/** النقر : موضع إدراج ، أو زرّ في الشريط ، أو تحديد صورة ، أو إلغاء التحديد */
function wireInlineClick(paper) {
  paper.addEventListener('click', async e => {
    if (inlLocked()) {
      inlDeselect();
      if (e.target.closest('.inl, .slot') && await lockAsk('تعديل الصور')) inlSelect(e.target.closest('.inl'));
      return;
    }
    const slot = e.target.closest('.slot');
    if (slot) {
      e.preventDefault();
      INL.slot = slot;
      INL.box = slot.closest('.sectbox');
      return openStudio('gallery');
    }
    const btn = e.target.closest('[data-ia]');
    if (btn && INL.sel) {
      e.preventDefault(); e.stopPropagation();
      const sp = INL.sel;
      const [a, v] = btn.dataset.ia.split(':');
      if (await inlAction(a, v, sp, btn)) return;
      inlSelect(sp);
      inlSave(sp);
      return;
    }
    const sp = e.target.closest('.inl');
    if (sp) { if (INL.sel !== sp) inlSelect(sp); return; }
    if (!e.target.closest('.inlbar')) inlDeselect();
  });

  /* السحب الأصلي للمتصفح كان يُسقط نسخة ثانية بحجم كامل داخل النصّ ـ يُمنع */
  paper.addEventListener('dragstart', e => e.preventDefault());
  paper.addEventListener('drop', e => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes('text/html')) e.preventDefault();
  });
}

/** المقابض : تحجيم من الأركان ، وتحريك من داخل الصورة في الوضع الحرّ */
function wireInlineDrag(paper) {
  let drag = null;

  paper.addEventListener('pointerdown', e => {
    if (inlLocked()) return;
    const h = e.target.closest('.inlh');
    const sp = e.target.closest('.inl');
    if (!sp) return;
    if (h) {
      e.preventDefault(); e.stopPropagation();
      const host = sp.closest('.sectbox') || sp.closest('.sectwrap');
      drag = { mode: 'size', sp, corner: h.dataset.corner || 'bl',
               x0: e.clientX, w0: +sp.dataset.w || 90, W: (host && host.clientWidth) || 690 };
      try { paper.setPointerCapture(e.pointerId); } catch {}
      return;
    }
    if (sp.classList.contains('free') && !e.target.closest('.inlbar')) {
      e.preventDefault(); e.stopPropagation();
      drag = { mode: 'move', sp, x0: e.clientX, y0: e.clientY,
               ox: +sp.dataset.x || 0, oy: +sp.dataset.y || 0 };
      try { paper.setPointerCapture(e.pointerId); } catch {}
    }
  });

  paper.addEventListener('pointermove', e => {
    if (!drag) return;
    if (drag.mode === 'move') {
      drag.sp.dataset.x = Math.round(drag.ox - (e.clientX - drag.x0));   // الورقة تُقاس من اليمين
      drag.sp.dataset.y = Math.round(drag.oy + (e.clientY - drag.y0));
      return inlApplyFree(drag.sp);
    }
    // التحجيم : ركن أيسر يكبّر بالسحب يساراً ، وأيمن بالسحب يميناً
    const raw = e.clientX - drag.x0;
    const dx = drag.corner.includes('l') ? -raw : raw;
    const w = Math.max(10, Math.min(100, drag.w0 + dx / drag.W * 100));
    drag.sp.dataset.w = Math.round(w);
    drag.sp.style.width = w.toFixed(1) + '%';
    const lbl = $('.inlbar span', drag.sp);
    if (lbl) lbl.textContent = ar(Math.round(w)) + '٪';
  });

  const end = () => { if (drag) { inlSave(drag.sp); drag = null; } };
  paper.addEventListener('pointerup', end);
  paper.addEventListener('pointercancel', end);
}

/** لوحة المفاتيح : حذف الصورة ، وتحريكها بالأسهم في الوضع الحرّ */
function wireInlineKeys(paper) {
  document.addEventListener('keydown', e => {
    if (inlLocked()) return;
    if (!INL.sel || !document.contains(INL.sel)) return;
    const sp = INL.sel;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return inlRemove(sp); }
    if (e.key === 'Escape') return inlDeselect();
    if (!sp.classList.contains('free') || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 2;
    const move = { ArrowLeft: ['x', step], ArrowRight: ['x', -step],
                   ArrowUp: ['y', -step], ArrowDown: ['y', step] }[e.key];
    sp.dataset[move[0]] = (+sp.dataset[move[0]] || 0) + move[1];
    inlApplyFree(sp);
    inlSave(sp);
  });
}

function wireInline() {
  const paper = byId('paper');
  if (!paper || paper.dataset.inlwired) return;
  paper.dataset.inlwired = '1';
  wireInlineClick(paper);
  wireInlineDrag(paper);
  wireInlineKeys(paper);
}

/* ═══ الكتابة في أيّ مكان داخل الصندوق ═══
   صندوق النصّ بارتفاع محتواه ، فالنقر تحت آخر سطر كان يقع على إطار القسم
   فلا يستقبل الكتابة. هنا نحوّل أيّ نقرة داخل القسم إلى مؤشّر في نهايته. */
function wireBoxClick() {
  const paper = byId('paper');
  if (!paper || paper.dataset.boxwired) return;
  paper.dataset.boxwired = '1';
  paper.addEventListener('mousedown', async e => {
    /* المقفل يُسأل أوّلاً : الصندوق يحمل contenteditable="false" وهو مقفل ،
       فلو تركنا الحارس أدناه يسبق لخرجنا قبل أن نعرض الفتح. */
    if (inlLocked()) {
      if (!e.target.closest('.sheet')) return;
      e.preventDefault();
      await lockAsk('التعديل');
      return;
    }
    if (e.target.closest('.inl, .inlbar, .inlh, .slot, .hctl, [contenteditable]')) return;
    const wrap = e.target.closest('.sectwrap, .sect');
    const box = wrap && $('[contenteditable][data-f]', wrap);
    if (!box) return;
    e.preventDefault();
    box.focus();
    const r = document.createRange();
    r.selectNodeContents(box); r.collapse(false);       // المؤشّر بعد آخر حرف
    const sel = document.getSelection();
    sel.removeAllRanges(); sel.addRange(r);
    box.scrollIntoView({ block: 'nearest' });
  });
}
