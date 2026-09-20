/* ═══ تفاعل صور الأقسام : التحديد ، الشريط ، المقابض ، اللصق والإفلات ═══ */

/** تحجيم أو تدوير أو تحريك بحسب المقبض الممسوك */
function figDrag(act, e) {
  const { kind, f, fg, hostR, r0 } = act;
  const dx = e.clientX - act.x0, dy = e.clientY - act.y0;
  const hostW = hostR.width || 1;

  if (kind === 'move') {
    if (f.mode !== 'free') { f.mode = 'free'; fg.classList.add('free'); }
    f.x = Math.max(0, Math.round(hostR.right - (e.clientX - act.dx) - fg.offsetWidth));
    f.y = Math.max(0, Math.round(e.clientY - act.dy - hostR.top));
  } else if (kind === 'rot') {
    const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    const a = Math.round(Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI - 90);
    f.rot = Math.max(-90, Math.min(90, a));
  } else if (kind === 'e' || kind === 'w') {           // مدّ أفقي ـ اليمين هو الأصل
    const d = kind === 'w' ? dx : -dx;
    f.w = Math.max(15, Math.min(100, Math.round(act.w0 + (d / hostW) * 100)));
  } else if (kind === 'n' || kind === 's') {           // مدّ رأسي
    f.h = Math.max(30, Math.round(act.h0 + (kind === 'n' ? -dy : dy)));
  } else {                                             // الأركان : بالنسبة نفسها
    const d = /w$/.test(kind) ? dx : -dx;
    f.w = Math.max(15, Math.min(100, Math.round(act.w0 + (d / hostW) * 100)));
    f.h = 0;
  }
  fg.setAttribute('style', figStyle(f));
  fg.classList.toggle('fixed', !!f.h);
}

function wireFigSelect(paper) {
  paper.addEventListener('click', e => {
    if (e.target.closest('[data-figbar]') || e.target.closest('.fh')) return;
    const fg = e.target.closest('.fig');
    const i = fg ? +fg.dataset.fig : null;
    if (figSel !== i) { figSel = i; figTab = ''; renderEditor(); }
  });

  paper.addEventListener('click', async e => {
    const b = e.target.closest('[data-figact]');
    if (!b) return;
    e.stopPropagation();
    const s = curSession(), list = figsOf(s), i = +b.dataset.figi;
    const [act, val] = b.dataset.figact.split(':');
    if (act === 'tab') { figTab = figTab === val ? '' : val; return renderEditor(); }
    if (act === 'alpha') b.textContent = '…';
    await figApply(act, val, list[i], list, i, s);
    renderEditor();
  });

  /* المؤثّرات اللونية : تُطبَّق حيّة بلا إعادة رسم كاملة */
  paper.addEventListener('input', e => {
    const r = e.target.closest('[data-figset]');
    if (!r) return;
    const s = curSession(), list = figsOf(s), f = list[+r.dataset.figi];
    f[r.dataset.figset] = +r.value;
    const fg = r.closest('.fig');
    if (fg) fg.setAttribute('style', figStyle(f));
    setFigs(s, list);
  });
}

function wireFigHandles(paper) {
  let act = null;

  paper.addEventListener('pointerdown', e => {
    const h = e.target.closest('.fh'), grab = e.target.closest('.fighandle');
    const fg = (h || grab) ? (h || grab).closest('.fig') : null;
    if (!fg) return;
    e.preventDefault(); e.stopPropagation();
    const s = curSession(), list = figsOf(s), f = list[+fg.dataset.fig];
    const r = fg.getBoundingClientRect();
    const host = fg.closest('.sectwrap') || fg.parentElement;
    act = { kind: h ? h.dataset.fh : 'move', s, list, f, fg, host,
            r0: r, hostR: host.getBoundingClientRect(),
            x0: e.clientX, y0: e.clientY, w0: f.w, h0: f.h || r.height,
            dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
    if (act.kind === 'move') host.style.position = 'relative';
    fg.setPointerCapture?.(e.pointerId);
  });

  paper.addEventListener('pointermove', e => {
    if (!act) return;
    act.moved = true;
    figDrag(act, e);
  });

  const end = () => {
    if (!act) return;
    if (act.moved) { setFigs(act.s, act.list); renderEditor(); }
    act = null;
  };
  paper.addEventListener('pointerup', end);
  paper.addEventListener('pointercancel', end);
}

function wireFigDrop(paper) {
  paper.addEventListener('paste', e => {
    const items = [...(e.clipboardData ? e.clipboardData.items : [])]
      .filter(it => it.type.startsWith('image/'));
    if (!items.length) return;
    e.preventDefault();
    insertImage(items[0].getAsFile());
  });
  paper.addEventListener('dragover', e => {
    if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); paper.classList.add('dropping'); }
  });
  paper.addEventListener('dragleave', () => paper.classList.remove('dropping'));
  paper.addEventListener('drop', e => {
    const f = [...(e.dataTransfer.files || [])].find(x => x.type.startsWith('image/'));
    if (!f) return;
    e.preventDefault();
    paper.classList.remove('dropping');
    insertImage(f);
  });
}

function wireFigs() {
  const paper = byId('paper');
  if (!paper || paper.dataset.figwired) return;
  paper.dataset.figwired = '1';
  wireFigSelect(paper);
  wireFigHandles(paper);
  wireFigDrop(paper);
}
