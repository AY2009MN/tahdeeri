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
