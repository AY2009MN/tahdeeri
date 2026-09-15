/* =====================================================================
   صور الأمثلة داخل ورقة التحضير
   ــ الإدراج : بالزرّ ، أو لصق من الحافظة (Ctrl+V) ، أو سحب وإفلات ، أو قصّ من الكتاب.
   ــ عند تحديد الصورة يظهر :
        • شريط أدوات فوقها فيه خيارات التعديل
        • ثماني مقابض على الأطراف : الأركان تكبّر وتصغّر بالنسبة نفسها ،
          والجانبية تمدّ أفقياً ، والعلوية والسفلية تمدّ رأسياً
        • مقبض تدوير أسفل الصورة
   ــ المؤثّرات اللونية غير متلفة (مرشّحات CSS) ، وتفريغ الخلفية يعالج البكسلات.
   ــ التراكب ممنوع في أوضاع «عادي / يمين / يسار» ، ومتاح في «حرّ» بترتيب طبقات.
   ===================================================================== */

const FIG_DEFAULTS = { sec: 'show', label: '', labelPos: 'top', labelSize: 13, mode: 'block', x: 0, y: 0, w: 100, h: 0, rot: 0,
                       behind: false, z: 1, b: 100, c: 100, sat: 100 };
let figSel = null;        // فهرس الصورة المحدَّدة
let figTab = '';          // لوحة فرعية مفتوحة : '' أو 'colors'

const figsOf = s => {
  const p = prepOf(s);
  return (p.figs !== undefined ? p.figs : (s.figs || [])).map(f => ({ ...FIG_DEFAULTS, ...f }));
};

function setFigs(s, list) {
  const p = prepCache[s.id] || (prepCache[s.id] = { id: s.id });
  p.figs = list;
  markDirty(s);
}

/* ────────── الأنماط ────────── */
function figStyle(f) {
  const out = [];
  if (f.mode === 'free') {
    out.push('position:absolute', `right:${f.x}px`, `top:${f.y}px`, `width:${f.w}%`);
    out.push('z-index:' + (f.behind ? 0 : 1 + (f.z || 1)));
  } else {
    const al = f.mode === 'right' ? 'flex-start' : f.mode === 'left' ? 'flex-end' : 'center';
    out.push(`align-self:${al}`, `width:${f.w}%`, 'margin:2mm 0');
  }
  if (f.h) out.push(`height:${f.h}px`, 'flex:0 0 auto');
  if (f.rot) out.push(`transform:rotate(${f.rot}deg)`);
  out.push(`filter:brightness(${f.b}%) contrast(${f.c}%) saturate(${f.sat}%)`);
  return out.join(';');
}

/* ────────── الرسم ────────── */
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function figsHTML(s, sec) {
  const list = figsOf(s);
  if (!list.length) return '';
  const want = sec || 'show';
  const inSec = list.map((f, i) => ({ f, i })).filter(o => (o.f.sec || 'show') === want);
  if (!inSec.length) return '';
  return `<div class="figs" data-figs>${inSec.map(({ f, i }) => {
    const on = figSel === i;
    return `
    <figure class="fig ${f.mode === 'free' ? 'free' : ''} ${on ? 'sel' : ''} ${f.h ? 'fixed' : ''}"
            data-fig="${i}" style="${figStyle(f)}">
      ${f.label && f.labelPos === 'top'
          ? `<div class="figlabel" style="font-size:${f.labelSize || 13}px">${mathWrap(esc(f.label))}</div>` : ''}
      <div class="figrow ${f.label && f.labelPos === 'side' ? 'side' : ''}">
        ${f.label && f.labelPos === 'side'
          ? `<div class="figlabel side" style="font-size:${f.labelSize || 13}px">${mathWrap(esc(f.label))}</div>` : ''}
        <img src="${esc(f.src)}" alt="${esc(f.cap || '')}" draggable="false">
      </div>
      ${f.cap ? `<figcaption class="figcap">${esc(f.cap)}</figcaption>` : ''}
      ${on
        ? figBar(i, f)
          + HANDLES.map(h => `<i class="fh ${h}" data-fh="${h}" data-figi="${i}"></i>`).join('')
          + `<i class="fh rot" data-fh="rot" data-figi="${i}" title="تدوير"></i>`
        : '<button class="fighandle no-print" title="تحديد الصورة">✥</button>'}
    </figure>`;
  }).join('')}</div>`;
}

const fb = (act, i, label, active, title) =>
  `<button class="fb${active ? ' on' : ''}" data-figact="${act}" data-figi="${i}"${title ? ` title="${title}"` : ''}>${label}</button>`;

/* شريط الأدوات فوق الصورة */
function figBar(i, f) {
  const pos = `<span class="fgrp">
      ${fb('mode:block', i, '≡', f.mode === 'block', 'توسيط')}
      ${fb('mode:right', i, '⇥', f.mode === 'right', 'محاذاة يمين')}
      ${fb('mode:left',  i, '⇤', f.mode === 'left',  'محاذاة يسار')}
      ${fb('mode:free',  i, '✥', f.mode === 'free',  'وضع حرّ')}
    </span>`;
  const size = `<span class="fgrp">
      ${fb('w:-8', i, '−', false, 'تصغير')}
      <span class="fv">${ar(f.w)}٪</span>
      ${fb('w:8', i, '+', false, 'تكبير')}
      ${fb('fit', i, '⤢', false, 'إرجاع النسبة الطبيعية')}
    </span>`;
  const layer = f.mode === 'free'
    ? `<span class="fgrp">${fb('z:1', i, '▲', false, 'إلى الأمام')}<span class="fv">${ar(f.z || 1)}</span>${fb('z:-1', i, '▼', false, 'إلى الخلف')}</span>`
    : '';
  const rest = `<span class="fgrp">
      ${fb('behind', i, '⧉', f.behind, 'خلف النص')}
      ${fb('alpha', i, '▨', false, 'تفريغ الخلفية')}
      ${fb('tab:colors', i, '◑', figTab === 'colors', 'الألوان والتدوير')}
      ${fb('sec', i, (f.sec || 'show') === 'show' ? '❷' : '❶', false, 'نقل بين صفحتَي العرض')}
      ${fb('lbl', i, '🅣', false, 'نصّ مع الصورة')}
      ${f.label ? fb('lpos', i, f.labelPos === 'top' ? '⬆' : '⬅', false, 'موضع النصّ : فوق / بجانب') : ''}
      ${f.label ? fb('lsz:1', i, 'A+', false, 'تكبير خطّ النصّ') + fb('lsz:-1', i, 'A−', false, 'تصغير خطّ النصّ') : ''}
      ${fb('reset', i, '↺', false, 'إرجاع كل التعديلات')}
      ${fb('del', i, '🗑', false, 'حذف الصورة')}
    </span>`;
  const colors = figTab === 'colors' ? `
    <div class="figcolors">
      <label>سطوع <input type="range" min="50" max="160" value="${f.b}"   data-figset="b"   data-figi="${i}"></label>
      <label>تباين <input type="range" min="50" max="200" value="${f.c}"   data-figset="c"   data-figi="${i}"></label>
      <label>تشبّع <input type="range" min="0"  max="200" value="${f.sat}" data-figset="sat" data-figi="${i}"></label>
      <label>تدوير <input type="range" min="-45" max="45" value="${f.rot}" data-figset="rot" data-figi="${i}"></label>
    </div>` : '';
  return `<div class="figbar no-print" data-figbar>${pos}${size}${layer}${rest}${colors}</div>`;
}

/* ────────── تفريغ الخلفية البيضاء ────────── */
function removeWhite(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      try {
        const im = cx.getImageData(0, 0, c.width, c.height), d = im.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
          if (mn >= 248 && mx - mn <= 6) d[i + 3] = 0;
          else if (mn >= 236 && mx - mn <= 8) d[i + 3] = Math.round(255 - ((mn - 236) / 12) * 255);
        }
        cx.putImageData(im, 0, 0);
        res(c.toDataURL('image/png'));
      } catch (e) { rej(e); }
    };
    img.onerror = rej;
    img.src = src;
  });
}

/* ────────── التفاعل ────────── */
function wireFigs() {
  const paper = document.getElementById('paper');
  if (!paper || paper.dataset.figwired) return;
  paper.dataset.figwired = '1';

  const cur = () => sessionsIdx[grade][curIdx];

  /* التحديد وإلغاؤه */
  paper.addEventListener('click', e => {
    if (e.target.closest('[data-figbar]') || e.target.closest('.fh')) return;
    const fg = e.target.closest('.fig');
    const i = fg ? +fg.dataset.fig : null;
    if (figSel !== i) { figSel = i; figTab = ''; renderEditor(); }
  });

  /* أزرار الشريط */
  paper.addEventListener('click', async e => {
    const b = e.target.closest('[data-figact]'); if (!b) return;
    e.stopPropagation();
    const s = cur(), list = figsOf(s), i = +b.dataset.figi, f = list[i];
    const [act, val] = b.dataset.figact.split(':');

    if (act === 'mode')   f.mode = val;
    if (act === 'behind') f.behind = !f.behind;
    if (act === 'w')      f.w = Math.max(15, Math.min(100, f.w + (+val)));
    if (act === 'z')      f.z = Math.max(1, Math.min(20, (f.z || 1) + (+val)));
    if (act === 'fit')    { f.h = 0; f.rot = 0; }
    if (act === 'lbl')    { const t = prompt('النصّ الذي يظهر مع الصورة :', f.label || ''); if (t !== null) f.label = t.trim(); }
    if (act === 'lpos')   f.labelPos = f.labelPos === 'top' ? 'side' : 'top';
    if (act === 'lsz')    f.labelSize = Math.max(12, Math.min(16, (f.labelSize || 13) + (+val)));
    if (act === 'sec')    f.sec = (f.sec || 'show') === 'show' ? 'show2' : 'show';
    if (act === 'tab')    { figTab = figTab === val ? '' : val; return renderEditor(); }
    if (act === 'reset')  Object.assign(f, { b: 100, c: 100, sat: 100, w: 100, h: 0, rot: 0, mode: 'block', x: 0, y: 0, behind: false, z: 1 });
    if (act === 'del')    { list.splice(i, 1); figSel = null; setFigs(s, list); return renderEditor(); }
    if (act === 'alpha')  { b.textContent = '…'; try { f.src = await removeWhite(f.src); } catch { alert('تعذّر تفريغ الخلفية لهذه الصورة.'); } }
    setFigs(s, list); renderEditor();
  });

  /* المؤثّرات الحيّة */
  paper.addEventListener('input', e => {
    const r = e.target.closest('[data-figset]'); if (!r) return;
    const s = cur(), list = figsOf(s), f = list[+r.dataset.figi];
    f[r.dataset.figset] = +r.value;
    const fg = r.closest('.fig');
    if (fg) fg.setAttribute('style', figStyle(f));
    setFigs(s, list);
  });

  /* المقابض : تحجيم ومدّ وتدوير ، ومقبض النقل */
  let act = null;
  paper.addEventListener('pointerdown', e => {
    const h = e.target.closest('.fh');
    const grab = e.target.closest('.fighandle');
    const fg = (h || grab) ? (h || grab).closest('.fig') : null;
    if (!fg) return;
    e.preventDefault(); e.stopPropagation();
    const s = cur(), list = figsOf(s), i = +fg.dataset.fig, f = list[i];
    const r = fg.getBoundingClientRect();
    const host = fg.closest('.sectwrap') || fg.parentElement;
    act = { kind: h ? h.dataset.fh : 'move', s, list, f, fg, host,
            r0: r, hostR: host.getBoundingClientRect(),
            x0: e.clientX, y0: e.clientY, w0: f.w, h0: f.h || r.height,
            dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
    if (act.kind === 'move') host.style.position = 'relative';
    if (fg.setPointerCapture) fg.setPointerCapture(e.pointerId);
  });

  paper.addEventListener('pointermove', e => {
    if (!act) return;
    act.moved = true;
    const { kind, f, fg, hostR, r0 } = act;
    const dx = e.clientX - act.x0, dy = e.clientY - act.y0;
    const hostW = hostR.width || 1;

    if (kind === 'move') {
      if (f.mode !== 'free') { f.mode = 'free'; fg.classList.add('free'); }
      f.x = Math.max(0, Math.round(hostR.right - (e.clientX - act.dx) - fg.offsetWidth));
      f.y = Math.max(0, Math.round(e.clientY - act.dy - hostR.top));
    } else if (kind === 'rot') {
      const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
      let a = Math.round(Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI - 90);
      f.rot = Math.max(-90, Math.min(90, a));
    } else if (kind === 'e' || kind === 'w') {          // مدّ أفقي
      const d = kind === 'w' ? dx : -dx;                // اليمين هو الأصل في الصفحة العربية
      f.w = Math.max(15, Math.min(100, Math.round(act.w0 + (d / hostW) * 100)));
    } else if (kind === 'n' || kind === 's') {          // مدّ رأسي
      const d = kind === 'n' ? -dy : dy;
      f.h = Math.max(30, Math.round(act.h0 + d));
    } else {                                            // الأركان : تكبير وتصغير بالنسبة نفسها
      const d = /w$/.test(kind) ? dx : -dx;
      f.w = Math.max(15, Math.min(100, Math.round(act.w0 + (d / hostW) * 100)));
      f.h = 0;
    }
    fg.setAttribute('style', figStyle(f));
    fg.classList.toggle('fixed', !!f.h);
  });

  paper.addEventListener('pointerup', () => {
    if (!act) return;
    if (act.moved) { setFigs(act.s, act.list); renderEditor(); }
    act = null;
  });

  /* اللصق من الحافظة */
  paper.addEventListener('paste', e => {
    const items = [...(e.clipboardData ? e.clipboardData.items : [])].filter(it => it.type.startsWith('image/'));
    if (!items.length) return;
    e.preventDefault();
    insertImage(items[0].getAsFile());
  });

  /* السحب والإفلات */
  paper.addEventListener('dragover', e => {
    if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); paper.classList.add('dropping'); }
  });
  paper.addEventListener('dragleave', () => paper.classList.remove('dropping'));
  paper.addEventListener('drop', e => {
    const f = [...(e.dataTransfer.files || [])].find(x => x.type.startsWith('image/'));
    if (!f) return;
    e.preventDefault(); paper.classList.remove('dropping');
    insertImage(f);
  });
}
