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
