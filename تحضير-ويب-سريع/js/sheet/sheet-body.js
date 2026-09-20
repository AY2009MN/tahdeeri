/* ═══ جسم ورقة التحضير : الأقسام والصفحتان ═══ */

/** ضابط عدد الأسطر فوق عنوان القسم (١ إلى ٤ أسطر ، يُحفظ لكل حصة) */
function linesCtl(f, n) {
  return `<span class="hctl no-print">
    <button data-hf="${f}" data-hd="-1" title="سطر أقل" aria-label="سطر أقل">−</button>
    <span class="hv">${ar(n)} س</span>
    <button data-hf="${f}" data-hd="1" title="سطر أكثر" aria-label="سطر أكثر">+</button>
  </span>`;
}

/** قسم بصندوق واحد : نصّ + صور ، مع ضبط اختياري لعدد الأسطر */
function section(s, v, { f, title, grow = false, lines = null, figs = true }) {
  const n = lines || 1;
  const sized = lines !== null ? ` lines" style="--ln:${n}" data-lines="${n}` : '';
  return `<div class="sect${grow ? ' grow' : ''}">
    <div class="secttl">${title}${lines !== null ? linesCtl(f, n) : ''}</div>
    <div class="sectwrap${sized}">
      <div class="sectbox nb" contenteditable data-f="${f}">${renderRich(v(f, s[f] || ''))}</div>
      ${figs ? figsHTML(s, f) : ''}
    </div>
  </div>`;
}

/** صفحة واحدة من الورقة */
const page = (no, label, inner) =>
  `<div class="sheet" data-page="${no}" data-pagelbl="${label}">${inner}</div>`;

function sheetHTML(s) {
  const p = prepOf(s);
  const v = (k, fb) => (p[k] !== undefined && p[k] !== null && p[k] !== '') ? p[k] : (fb ?? '');
  const ln = p.lines || {};

  const page1 = headMeta(s) + headLesson(s) + headOutcomes(s, v) + headVocab(s, v) + headMedia(s, v)
    + section(s, v, { f: 'intro', title: 'المقدمة والتمهيد', lines: ln.intro || 1 })
    + section(s, v, { f: 'show', title: 'العرض', grow: true });

  const page2 = section(s, v, { f: 'show2', title: 'تابع العرض', grow: true })
    + `<div class="sect">
         <div class="secttl">الخاتمة والتقييم${linesCtl('close', ln.close || 1)}</div>
         <div class="sectbox lines" contenteditable data-f="close"
              style="--ln:${ln.close || 1}" data-lines="${ln.close || 1}">${renderRich(v('close', s.close))}</div>
       </div>`
    + section(s, v, { f: 'evalx', title: 'التقويم', lines: ln.evalx || 1 })
    + evalTable() + signLine();

  return page(1, 'الصفحة ١ من ٢', page1) + page(2, 'الصفحة ٢ من ٢', page2);
}

/* ═══ ورقة العمل : ٤ نسخ في صفحة A4 واحدة ═══ */
function worksheetHTML(s) {
  const w = s.worksheet;
  if (!w) return '<p class="hint" style="text-align:center">لا توجد ورقة عمل لهذه الحصة.</p>';
  const manual = !!S?.manualMeta;
  const wsDate = manual ? '……………………' : fmtDate(s.date);
  const wsClass = manual ? esc(s.gradeName)
    : `${esc(s.gradeName)} ـ ${esc((curClass() || s).name || s.section)}`;
  const cell = `
    <div class="wcell">
      <h5>${esc(w.title)}</h5>
      <div class="meta"><span>${wsClass}</span><span>${esc(s.code)} ${esc(s.title)}</span></div>
      <ol><li>${mathWrap(esc(w.q1))}</li><li>${mathWrap(esc(w.q2))}</li></ol>
      <div class="nameline">الاسم: ………………………………  التاريخ: ${wsDate}</div>
    </div>`;
  return `<div class="wsheet">${cell.repeat(4)}</div>`;
}
