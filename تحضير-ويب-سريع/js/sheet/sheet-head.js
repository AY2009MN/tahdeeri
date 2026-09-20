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
