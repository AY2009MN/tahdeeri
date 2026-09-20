/* ═══ أزرار شريط صفحات الكتاب ═══
   فُصلت عن studio-pdf.js ليبقى كلّ ملف في حدود المراجعة السهلة :
   هناك الرسم والتحميل ، وهنا الاستجابة للأزرار. */

/** يحفظ تصحيح بداية الدرس أو نهايته في الإعدادات */
async function setLessonEdge(which) {
  const p = currentBookPage();
  S.pageMap ||= {};
  S.pageMap[grade] ||= {};
  const cur = lessonRange(grade, bk.lesson) || [p, p];
  const next = which === 'from' ? [p, Math.max(p, cur[1])] : [Math.min(cur[0], p), p];
  S.pageMap[grade][bk.lesson] = next;
  await DB.put('settings', S);
  bk.from = next[0]; bk.to = next[1]; bk.all = false;
  bookBar();
  await drawBookPages();
  toast(`حُفظت صفحات الدرس ${bk.lesson}: ص${ar(printedPage(next[0]))} ـ ص${ar(printedPage(next[1]))}`);
}

function wireBookPages(v) {
  v.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;

    if (b.id === 'stGoLib') { closeStudio(); return show('library'); }
    if (b.id === 'stModeRect') { bk.mode = 'rect'; return bookBar(); }
    if (b.id === 'stModeFree') { bk.mode = 'free'; return bookBar(); }
    if (b.id === 'stZin') { bk.scale = Math.min(3, bk.scale + 0.2); return keepBookPage(drawBookPages); }
    if (b.id === 'stZout') { bk.scale = Math.max(0.7, bk.scale - 0.2); return keepBookPage(drawBookPages); }
    if (b.id === 'stAll') {
      bk.all = !bk.all;
      bookBar();
      await drawBookPages();
      if (bk.all) gotoBookPage(bk.from);
      return;
    }
    if (b.id === 'stGo') return gotoBookPage(pdfPageFromPrinted(+byId('stPageNo').value));
    if (b.id === 'stSetFrom') return setLessonEdge('from');
    if (b.id === 'stSetTo') return setLessonEdge('to');
  });

  v.addEventListener('change', e => {
    if (e.target.id !== 'stLesson') return;
    bk.all = false;
    openBookPages(e.target.value);
  });

  v.addEventListener('keydown', e => {
    if (e.target.id === 'stPageNo' && e.key === 'Enter')
      gotoBookPage(pdfPageFromPrinted(+e.target.value));
  });
}
