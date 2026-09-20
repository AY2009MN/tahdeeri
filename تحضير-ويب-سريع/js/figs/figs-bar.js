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
