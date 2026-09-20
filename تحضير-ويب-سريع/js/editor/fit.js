/* ═══ ضبط المحتوى على الصفحتين ═══
   يُصغَّر ما في الصندوق الممتلئ من صور بأقلّ قدر يكفي لاتّساعه ، بالبحث الثنائي
   على معامل التصغير.

   نوعان :
   • ضبط تلقائي (autoFit) : يعمل بعد كل رسم ، ويغيّر العرض المعروض فقط ولا
     يمسّ البيانات المحفوظة. غرضه ألّا تُقصّ صورة في الطباعة من غير أن يدري
     المعلّم ـ وهي علّة كانت تصيب أكثر صفحات المنهج الجاهزة.
   • ضبط يدوي (fitToPages) : يثبّت العروض الجديدة في التحضير نفسه. */

/** يصغّر صور صندوق واحد حتى يتّسع. يعيد 'ok' أو 'stuck' أو 'skip' */
function fitOneBox(w, persist) {
  const inls = $$('.inl', w);
  const over = () => w.scrollHeight > w.clientHeight + 2;
  if (!over()) return 'skip';
  if (!inls.length) return 'stuck';

  const base = inls.map(sp => +sp.dataset.w || parseFloat(sp.style.width) || 90);
  const apply = f => inls.forEach((sp, i) =>
    sp.style.width = Math.max(18, base[i] * f).toFixed(1) + '%');

  let lo = 0.25, hi = 1;
  apply(lo);
  if (over()) return 'stuck';                       // حتى أصغر حجم لا يكفي
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    apply(mid);
    if (over()) hi = mid; else lo = mid;
  }
  apply(lo);
  if (persist) inls.forEach(sp => { sp.dataset.w = Math.round(parseFloat(sp.style.width)); });
  return 'ok';
}

/** يمرّ على صناديق الورقة ويعيد {fixed, stuck} */
function fitAllBoxes(persist) {
  let fixed = 0, stuck = 0;
  $$('#paper .sectwrap').forEach(w => {
    const r = fitOneBox(w, persist);
    if (r === 'ok') fixed++;
    if (r === 'stuck') stuck++;
    if (persist && r !== 'skip') {
      const box = $('[contenteditable][data-f]', w);
      if (box) box.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  return { fixed, stuck };
}

/** ضبط تلقائي بعد الرسم ـ عرضاً فقط ، فلا يُعدّل التحضير المحفوظ */
function autoFitPages() {
  if (effectiveMode() === 'screen') return checkOverflow();
  const { fixed, stuck } = fitAllBoxes(false);
  checkOverflow();
  if (stuck) return;
  if (fixed) setText('pagesInfo',
    `صُغّرت صور ${ar(fixed)} صناديق تلقائياً لتناسب الصفحة ـ الطباعة مطابقة للمعاينة`);
}

/** ضبط يدوي ـ يثبّت العروض الجديدة في التحضير */
function fitToPages() {
  if (effectiveMode() === 'screen') {
    toast('«اضبط الصفحتين» يعمل في مقاس A4 ـ حوّلنا العرض إليه.');
    S.viewMode = 'a4';
    DB.put('settings', S);
    applyViewMode();
    renderEditor();
    return setTimeout(fitToPages, 300);
  }
  const { fixed, stuck } = fitAllBoxes(true);
  checkOverflow();
  if (fixed && !stuck) setText('pagesInfo', `ثُبّت مقاس ${ar(fixed)} صناديق في التحضير`);
  if (stuck) alert('بعض الصناديق ما زالت ممتلئة حتى بعد التصغير.\n' +
                   'احذف عنصراً أو انقله إلى «تابع العرض» في الصفحة الثانية.');
  if (!fixed && !stuck) toast('كل الصناديق متّسعة ـ لا حاجة إلى ضبط.');
}

window.fitSheets = () => autoFitPages();
