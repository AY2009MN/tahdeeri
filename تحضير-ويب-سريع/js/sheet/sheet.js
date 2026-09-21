/* ═══ رأس ورقة التحضير ═══
   الجداول العلوية : التاريخ والصف والحصة ، بيانات الدرس ، النواتج والمعيار ،
   المفردات ، الوسائل. كلّ جدول دالّة مستقلّة يمكن إخفاؤها من الإعدادات. */

/** صفوف جدول التاريخ والصف والحصة ـ تُترك فارغة في وضع الكتابة اليدوية */
function headMetaRows(s) {
  const manual = !!S?.manualMeta;
  const first = manual
    ? '<tr><td class="valb">&nbsp;</td><td class="valb">&nbsp;</td><td class="valb">&nbsp;</td></tr>'
    : `<tr><td class="valb">${fmtDate(s.date)}</td>` +
      `<td class="valb">${esc((curClass() || s).name || s.section)}</td>` +
      `<td class="valb">${s.period ? ar(s.period) : '……'}</td></tr>`;
  return first + '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>'.repeat(2);
}

function headMeta(s) {
  return `<div class="hdrwrap">
    <div class="tscroll"><table>
      <tr><td class="lbl">اليوم والتاريخ</td><td class="lbl">الصف</td><td class="lbl">الحصة</td></tr>
      ${headMetaRows(s)}
    </table></div>
    ${sectionOn('logo') ? '<div class="logobox"><img src="icons/logo.png" alt="" ' +
      'onerror="this.style.display=&quot;none&quot;"></div>' : ''}
  </div>`;
}

function headLesson(s) {
  return `<div class="tscroll"><table style="margin-top:2mm">
    <tr>
      <td class="lbl" style="width:13%">الوحدة</td><td class="lbl" style="width:30%">المجال</td>
      <td class="lbl" style="width:16%">البند</td><td class="lbl" style="width:41%">عنوان الدرس</td>
    </tr>
    <tr>
      <td class="val">${esc(s.unitNo)}</td><td class="val">${esc(s.unitTitle)}</td>
      <td class="val">${esc(s.code)}</td><td class="val">${esc(s.title)}</td>
    </tr>
  </table></div>`;
}

function headOutcomes(s, v) {
  if (!sectionOn('osi')) return '';
  const cell = f => `<td class="cellin" contenteditable data-f="${f}">${mathWrap(esc(v(f, s[f])))}</td>`;
  return `<div class="tscroll"><table style="margin-top:1mm">
    <tr><td class="lbl" style="width:34%">نواتج التعلم</td>
        <td class="lbl" style="width:33%">المعيار</td>
        <td class="lbl" style="width:33%">مؤشرات الأداء</td></tr>
    <tr style="height:16mm">${cell('outcomes')}${cell('standard')}${cell('indicators')}</tr>
  </table></div>`;
}

function headVocab(s, v) {
  if (!sectionOn('vocab')) return '';
  return `<div class="tscroll"><table style="margin-top:1mm">
    <tr><td class="lbl" style="width:22%">العبارات والمفردات :</td>
        <td class="cellin" contenteditable data-f="vocab">${mathWrap(esc(v('vocab', s.vocab)))}</td></tr>
  </table></div>`;
}

function headMedia(s, v) {
  if (!sectionOn('media')) return '';
  const media = s.media.slice(0, 3);
  while (media.length < 3) media.push('اختيار عنصر.');
  const cells = media.map((m, i) =>
    `<td class="cellin" contenteditable data-f="m${i}">${esc(v('m' + i, m))}</td>`).join('');
  return `<div class="tscroll"><table style="margin-top:1mm">
    <tr>
      <td class="lbl" style="width:22%">الوسائل التعليمية</td>
      <td class="lbl" style="width:13%">الكتاب</td>
      ${cells}
    </tr>
  </table></div>`;
}

/** جدول التقويم في أسفل الصفحة الثانية */
function evalTable() {
  if (!sectionOn('evalTable')) return '';
  const rows = '<tr>' + '<td contenteditable>&nbsp;</td>'.repeat(5) + '</tr>';
  return `<div class="tscroll"><table style="margin-top:2mm">
    <tr>
      <td class="lbl" style="width:10%">الصف</td>
      <td class="lbl" style="width:24%">مدى تحقق نواتج التعلم</td>
      <td class="lbl" style="width:26%">ملائمة التحضير مع زمن الحصة</td>
      <td class="lbl" style="width:26%">فعالية الوسائل التعليمية المستخدمة</td>
      <td class="lbl" style="width:14%">التطبيق</td>
    </tr>
    ${rows.repeat(3)}
  </table></div>`;
}

const signLine = () => sectionOn('sign')
  ? `<div class="sign">معلّم المادة: ${esc(S.teacher || '……………………')}</div>` : '';

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

/* ═══ النموذج الفارغ للكتابة اليدوية ═══
   القالب الرسمي نفسه بلا تاريخ ولا صف ولا محتوى ، مع أسطر مسطَّرة
   بارتفاع ٨مم يكتب عليها المعلّم بخطّ يده. يُطبع بحدود سوداء صريحة. */

const blankRows = n => '<div class="rline"></div>'.repeat(n);
const blankCells = n => '<td></td>'.repeat(n);

function blankHead() {
  return `<div class="hdrwrap">
      <div class="tscroll"><table>
        <tr><td class="lbl">اليوم والتاريخ</td><td class="lbl">الصف</td><td class="lbl">الحصة</td></tr>
        <tr style="height:9mm">${blankCells(3)}</tr>
      </table></div>
      ${sectionOn('logo') ? '<div class="logobox"><img src="icons/logo.png" alt="" ' +
        'onerror="this.style.display=&quot;none&quot;"></div>' : ''}
    </div>

    <div class="tscroll"><table style="margin-top:2mm">
      <tr>
        <td class="lbl" style="width:13%">الوحدة</td><td class="lbl" style="width:30%">المجال</td>
        <td class="lbl" style="width:16%">البند</td><td class="lbl" style="width:41%">عنوان الدرس</td>
      </tr>
      <tr style="height:9mm">${blankCells(4)}</tr>
    </table></div>

    <div class="tscroll"><table style="margin-top:1mm">
      <tr><td class="lbl" style="width:34%">نواتج التعلم</td>
          <td class="lbl" style="width:33%">المعيار</td>
          <td class="lbl" style="width:33%">مؤشرات الأداء</td></tr>
      <tr>${`<td class="rcell">${blankRows(3)}</td>`.repeat(3)}</tr>
    </table></div>

    <div class="tscroll"><table style="margin-top:1mm">
      <tr><td class="lbl" style="width:22%">العبارات والمفردات :</td>
          <td class="rcell">${blankRows(2)}</td></tr>
    </table></div>

    <div class="tscroll"><table style="margin-top:1mm">
      <tr>
        <td class="lbl" style="width:22%">الوسائل التعليمية</td>
        <td class="lbl" style="width:13%">الكتاب</td>
        <td style="height:8mm"></td>${blankCells(2)}
      </tr>
    </table></div>`;
}

const ruled = (title, style = '') =>
  `<div class="sect${style ? '' : ' grow'}">
     <div class="secttl">${title}</div>
     <div class="sectwrap ruled${style ? '' : ' grow'}"${style ? ` style="${style}"` : ''}></div>
   </div>`;

function blankSheetHTML() {
  const page1 = blankHead()
    + `<div class="sect" style="margin-top:3mm">
         <div class="secttl">المقدمة والتمهيد</div>
         <div class="sectwrap ruled" style="min-height:26mm"></div>
       </div>`
    + ruled('العرض');

  const page2 = ruled('تابع العرض')
    + ruled('الخاتمة والتقييم', 'min-height:18mm')
    + ruled('التقويم', 'min-height:26mm')
    + `<div class="tscroll"><table style="margin-top:2mm">
        <tr>
          <td class="lbl" style="width:10%">الصف</td>
          <td class="lbl" style="width:24%">مدى تحقق نواتج التعلم</td>
          <td class="lbl" style="width:26%">ملائمة التحضير مع زمن الحصة</td>
          <td class="lbl" style="width:26%">فعالية الوسائل التعليمية المستخدمة</td>
          <td class="lbl" style="width:14%">التطبيق</td>
        </tr>
        ${('<tr>' + blankCells(5) + '</tr>').repeat(3)}
      </table></div>
      <div class="sign">معلّم المادة: ……………………</div>`;

  return `<div class="sheet blank" data-page="1">${page1}</div>` +
         `<div class="sheet blank" data-page="2">${page2}</div>`;
}
