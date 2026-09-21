/* ═══ صور الأقسام : النموذج والرسم ═══
   صورة القسم (figure.fig) تعيش داخل إطار القسم ، لها موضع وحجم ومؤثّرات لونية.
   التراكب ممنوع في أوضاع «عادي / يمين / يسار» ، ومتاح في «حرّ» بترتيب طبقات. */

const FIG_DEFAULTS = {
  sec: 'show', label: '', labelPos: 'top', labelSize: 13,
  mode: 'block', x: 0, y: 0, w: 100, h: 0, rot: 0,
  behind: false, z: 1, b: 100, c: 100, sat: 100
};
const HANDLES = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];

let figSel = null;        // فهرس الصورة المحدَّدة
let figTab = '';          // لوحة فرعية مفتوحة : '' أو 'colors'

const figsOf = s => {
  const p = prepOf(s);
  return (p.figs !== undefined ? p.figs : (s.figs || [])).map(f => ({ ...FIG_DEFAULTS, ...f }));
};

function setFigs(s, list) {
  prepFor(s).figs = list;
  markDirty(s);
}

/* ────────── الأنماط ────────── */
function figStyle(f) {
  const out = [];
  if (f.mode === 'free') {
    out.push('position:absolute', `right:${f.x}px`, `top:${f.y}px`, `width:${f.w}%`,
             'z-index:' + (f.behind ? 0 : 1 + (f.z || 1)));
  } else {
    const al = f.mode === 'right' ? 'flex-start' : f.mode === 'left' ? 'flex-end' : 'center';
    out.push(`align-self:${al}`, `width:${f.w}%`, 'margin:2mm 0');
  }
  if (f.h) out.push(`height:${f.h}px`, 'flex:0 0 auto');
  if (f.rot) out.push(`transform:rotate(${f.rot}deg)`);
  out.push(`filter:brightness(${f.b}%) contrast(${f.c}%) saturate(${f.sat}%)`);
  return out.join(';');
}

const figLabel = (f, side) =>
  (f.label && f.labelPos === (side ? 'side' : 'top'))
    ? `<div class="figlabel${side ? ' side' : ''}" style="font-size:${f.labelSize || 13}px">${
        mathWrap(esc(f.label))}</div>`
    : '';

/** الصورة الواحدة داخل القسم */
function figHTML(f, i) {
  const on = figSel === i;
  const cls = ['fig', f.mode === 'free' ? 'free' : '', on ? 'sel' : '', f.h ? 'fixed' : ''].join(' ');
  const tools = on
    ? figBar(i, f)
      + HANDLES.map(h => `<i class="fh ${h}" data-fh="${h}" data-figi="${i}"></i>`).join('')
      + `<i class="fh rot" data-fh="rot" data-figi="${i}" title="تدوير"></i>`
    : '<button class="fighandle no-print" title="تحديد الصورة" aria-label="تحديد الصورة">✥</button>';
  return `<figure class="${cls}" data-fig="${i}" style="${figStyle(f)}">
      ${figLabel(f, false)}
      <div class="figrow ${f.label && f.labelPos === 'side' ? 'side' : ''}">
        ${figLabel(f, true)}
        <img src="${esc(f.src)}" alt="${esc(f.cap || '')}" draggable="false">
      </div>
      ${f.cap ? `<figcaption class="figcap">${esc(f.cap)}</figcaption>` : ''}
      ${tools}
    </figure>`;
}

/** كل صور قسم واحد */
function figsHTML(s, sec) {
  const list = figsOf(s);
  if (!list.length) return '';
  const want = sec || 'show';
  const inSec = list.map((f, i) => ({ f, i })).filter(o => (o.f.sec || 'show') === want);
  if (!inSec.length) return '';
  return `<div class="figs" data-figs>${inSec.map(({ f, i }) => figHTML(f, i)).join('')}</div>`;
}

/* ═══ شريط أدوات الصورة المحدَّدة ═══
   مجموعات مرتّبة : الموضع ، الحجم ، الطبقة ، بقيّة الخيارات ، ثم لوحة الألوان. */

const fb = (act, i, label, active, title) =>
  `<button class="fb${active ? ' on' : ''}" data-figact="${act}" data-figi="${i}"` +
  `${title ? ` title="${title}" aria-label="${title}"` : ''}>${label}</button>`;

const figGroupPos = (i, f) => `<span class="fgrp">
    ${fb('mode:block', i, '≡', f.mode === 'block', 'توسيط')}
    ${fb('mode:right', i, '⇥', f.mode === 'right', 'محاذاة يمين')}
    ${fb('mode:left', i, '⇤', f.mode === 'left', 'محاذاة يسار')}
    ${fb('mode:free', i, '✥', f.mode === 'free', 'وضع حرّ')}
  </span>`;

const figGroupSize = (i, f) => `<span class="fgrp">
    ${fb('w:-8', i, '−', false, 'تصغير')}
    <span class="fv">${ar(f.w)}٪</span>
    ${fb('w:8', i, '+', false, 'تكبير')}
    ${fb('fit', i, '⤢', false, 'إرجاع النسبة الطبيعية')}
  </span>`;

const figGroupLayer = (i, f) => f.mode !== 'free' ? '' : `<span class="fgrp">
    ${fb('z:1', i, '▲', false, 'إلى الأمام')}
    <span class="fv">${ar(f.z || 1)}</span>
    ${fb('z:-1', i, '▼', false, 'إلى الخلف')}
  </span>`;

const figGroupRest = (i, f) => `<span class="fgrp">
    ${fb('behind', i, '⧉', f.behind, 'خلف النص')}
    ${fb('alpha', i, '▨', false, 'تفريغ الخلفية')}
    ${fb('tab:colors', i, '◑', figTab === 'colors', 'الألوان والتدوير')}
    ${fb('sec', i, (f.sec || 'show') === 'show' ? '❷' : '❶', false, 'نقل بين صفحتَي العرض')}
    ${fb('lbl', i, '🅣', false, 'نصّ مع الصورة')}
    ${f.label ? fb('lpos', i, f.labelPos === 'top' ? '⬆' : '⬅', false, 'موضع النصّ : فوق أو بجانب') : ''}
    ${f.label ? fb('lsz:1', i, 'A+', false, 'تكبير خطّ النصّ') + fb('lsz:-1', i, 'A−', false, 'تصغير خطّ النصّ') : ''}
    ${fb('reset', i, '↺', false, 'إرجاع كل التعديلات')}
    ${fb('del', i, '🗑', false, 'حذف الصورة')}
  </span>`;

const FIG_SLIDERS = [
  ['b', 'سطوع', 50, 160], ['c', 'تباين', 50, 200],
  ['sat', 'تشبّع', 0, 200], ['rot', 'تدوير', -45, 45]
];

const figColors = (i, f) => figTab !== 'colors' ? '' : `<div class="figcolors">${
  FIG_SLIDERS.map(([k, t, min, max]) =>
    `<label>${t} <input type="range" min="${min}" max="${max}" value="${f[k]}"
       data-figset="${k}" data-figi="${i}" aria-label="${t}"></label>`).join('')}</div>`;

function figBar(i, f) {
  return `<div class="figbar no-print" data-figbar>${
    figGroupPos(i, f)}${figGroupSize(i, f)}${figGroupLayer(i, f)}${
    figGroupRest(i, f)}${figColors(i, f)}</div>`;
}

/** تنفيذ أمر من الشريط على الصورة ـ يعيد true إن لزم إعادة الرسم فوراً */
async function figApply(act, val, f, list, i, s) {
  if (act === 'mode') f.mode = val;
  if (act === 'behind') f.behind = !f.behind;
  if (act === 'w') f.w = Math.max(15, Math.min(100, f.w + (+val)));
  if (act === 'z') f.z = Math.max(1, Math.min(20, (f.z || 1) + (+val)));
  if (act === 'fit') { f.h = 0; f.rot = 0; }
  if (act === 'lbl') { const t = prompt('النصّ الذي يظهر مع الصورة :', f.label || ''); if (t !== null) f.label = t.trim(); }
  if (act === 'lpos') f.labelPos = f.labelPos === 'top' ? 'side' : 'top';
  if (act === 'lsz') f.labelSize = Math.max(12, Math.min(16, (f.labelSize || 13) + (+val)));
  if (act === 'sec') f.sec = (f.sec || 'show') === 'show' ? 'show2' : 'show';
  if (act === 'reset') Object.assign(f, { b: 100, c: 100, sat: 100, w: 100, h: 0, rot: 0,
                                          mode: 'block', x: 0, y: 0, behind: false, z: 1 });
  if (act === 'del') { list.splice(i, 1); figSel = null; }
  if (act === 'alpha') {
    try { f.src = await removeWhite(f.src); }
    catch { alert('تعذّر تفريغ الخلفية لهذه الصورة.'); }
  }
  setFigs(s, list);
  return true;
}

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

/* اللصق والإفلات : طريقان مباشران بلا مرورٍ على الاستوديو.
   القفل يمنعهما كما يمنع بقيّة التعديل ، والصورة تنزل في القسم الذي أُفلتت
   عليه لا في قسمٍ ثابت ، ويُبرَز ذلك القسم أثناء السحب. */
function wireFigDrop(paper) {
  let over = null;
  const mark = box => {
    if (over === box) return;
    over?.classList.remove('dropto');
    over = box;
    over?.classList.add('dropto');
  };

  paper.addEventListener('paste', e => {
    if (!LOCK.open) return;
    const items = [...(e.clipboardData ? e.clipboardData.items : [])]
      .filter(it => it.type.startsWith('image/'));
    if (!items.length) return;                       // نصٌّ عاديّ ـ يتركه للمتصفّح
    e.preventDefault();
    insertImage(items[0].getAsFile());
  });

  paper.addEventListener('dragover', e => {
    if (!LOCK.open || !e.dataTransfer) return;
    if (![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    mark(e.target.closest('.sectbox[data-f]'));
  });

  paper.addEventListener('dragleave', e => {
    if (!e.relatedTarget || !paper.contains(e.relatedTarget)) mark(null);
  });

  paper.addEventListener('drop', e => {
    const f = LOCK.open
      && [...(e.dataTransfer.files || [])].find(x => x.type.startsWith('image/'));
    mark(null);
    if (!f) return;
    e.preventDefault();
    inlTargetAtPoint(e.clientX, e.clientY);
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
