/* ═══ وضع عرض الورقة ═══
   • وضع الشاشة (screen) : الأقسام تتمدّد بعرض الجهاز وبارتفاع محتواها ،
     فالكتابة على الهاتف مريحة والخطّ بحجمه الطبيعي.
   • وضع A4 (a4)         : الورقة بمقاسها الحقيقي مصغَّرة لتناسب الشاشة ،
     لمراجعة ما سيخرج من الطابعة حرفياً.
   • تلقائي (auto)       : شاشة على الأجهزة الضيّقة ، و A4 على الحاسوب.
   الطباعة لا تتأثّر بأيّ من ذلك ـ تخرج A4 دائماً (انظر css/print.css). */

const VIEW_NARROW = 860;

/** الوضع الفعليّ بعد تطبيق «تلقائي» */
function effectiveMode() {
  const m = S?.viewMode || 'auto';
  if (m !== 'auto') return m;
  return window.innerWidth < VIEW_NARROW ? 'screen' : 'a4';
}

function applyViewMode() {
  const mode = effectiveMode();
  document.body.classList.toggle('screenmode', mode === 'screen');
  document.body.classList.toggle('a4mode', mode === 'a4');
  const b = byId('btnViewMode');
  if (b) {
    b.textContent = mode === 'screen' ? '📱 وضع الشاشة' : '📄 مقاس A4';
    b.title = mode === 'screen'
      ? 'الأقسام بعرض الجهاز ـ انقر لعرض الورقة بمقاس A4 كما تُطبع'
      : 'الورقة بمقاس A4 ـ انقر للعرض المريح على الشاشة';
  }
  zoomPaper();
}

/** يبدّل بين الوضعين ويحفظ الاختيار */
function toggleViewMode() {
  S.viewMode = effectiveMode() === 'screen' ? 'a4' : 'screen';
  DB.put('settings', S);
  applyViewMode();
  renderEditor();
}

/** في وضع A4 تُصغَّر الورقة بصرياً لتناسب الشاشة ، وهندستها تبقى بالمليمتر */
function zoomPaper() {
  const paper = byId('paper');
  if (!paper) return;
  if (effectiveMode() === 'screen') {
    paper.classList.remove('zoomed');
    paper.style.removeProperty('--pz');
    return;
  }
  const avail = (paper.parentElement || document.body).clientWidth - 20;
  paper.classList.add('zoomed');
  paper.style.setProperty('--pz', Math.min(1, avail / 800).toFixed(3));
}

/** تنبيه بصري عند تجاوز المحتوى ارتفاع الصندوق ، مع بيان حالة الطباعة */
function checkOverflow() {
  if (effectiveMode() === 'screen') {
    setText('pagesInfo', 'وضع الشاشة ـ الطباعة تخرج بمقاس A4');
    byId('pagesInfo')?.classList.remove('dirty');
    return;
  }
  let over = 0;
  $$('#paper .sectwrap, #paper .sectbox:not(.nb)').forEach(b => {
    const bad = b.scrollHeight > b.clientHeight + 4;
    if (bad) over++;
    b.classList.toggle('overflowwarn', bad);
  });
  const info = byId('pagesInfo');
  if (!info) return;
  info.textContent = over
    ? `تنبيه: ${ar(over)} صندوقاً ممتلئاً ـ صغّر صورة أو انقلها إلى الصفحة الثانية`
    : 'الطباعة مطابقة للمعاينة ـ صفحتان';
  info.classList.toggle('dirty', over > 0);
}

window.addEventListener('resize', debounce(() => { applyViewMode(); checkOverflow(); }, 150));

/* ═══ توزيع «العرض» على صفحتَي القالب ═══
   يُملأ صندوق الصفحة الأولى سطراً سطراً حتى يبلغ حدّه ، ويُنقل الباقي إلى
   «تابع العرض» في الصفحة الثانية ، فلا تبقى الصفحة الثانية فارغة.

   القياس يجري دائماً في نسخة خفيّة بمقاس A4 الحقيقي (#printArea) ، لا في
   الورقة المعروضة ، حتى يبقى التوزيع مطابقاً للطباعة في كلّ الأوضاع ـ
   وهذا ما يجعل التحرير على الهاتف لا يفسد ترقيم الصفحات. */

/** يبني صندوق قياس بمقاس A4 ويعيد {box, wrap, done} ـ done تُزيل النسخة */
function measureBox(s) {
  const host = byId('printArea');
  host.innerHTML = sheetHTML(s);
  const box = host.querySelector('.sectbox[data-f="show"]');
  const wrap = box && (box.closest('.sectwrap') || box.parentElement);
  return { box, wrap, done: () => { host.innerHTML = ''; } };
}

/** المساحة المتاحة للنصّ = ارتفاع الصندوق ناقص ارتفاع الصور التي تشاركه الإطار */
function textRoom(wrap) {
  const figsH = $$('.figs', wrap)
    .filter(x => getComputedStyle(x).position !== 'absolute')
    .reduce((a, x) => a + x.offsetHeight, 0);
  return Math.max(40, wrap.clientHeight - figsH - 8);
}

function flowShow(s) {
  const b1 = $('#paper .sectbox[data-f="show"]');
  const b2 = $('#paper .sectbox[data-f="show2"]');
  if (!b1 || !b2) return;

  const p = prepOf(s);
  if (p.show2 !== undefined && p.show2 !== '') return;  // كتب المعلّم في الصفحة الثانية ـ لا نلمسها
  if (s.show2) return;                                  // الدرس يوزّع محتواه بنفسه

  const text = String((p.show !== undefined && p.show !== '') ? p.show : (s.show || ''));
  const lines = text.split('\n');
  if (lines.length < 2) { b1.innerHTML = renderRich(text); b2.innerHTML = ''; return; }

  const m = measureBox(s);
  if (!m.wrap || m.wrap.clientHeight < 60) {            // تعذّر القياس ـ لا نقسّم
    m.done();
    b1.innerHTML = renderRich(text); b2.innerHTML = '';
    return;
  }

  // تُملأ الصفحة الأولى حتى ٦٢٪ من المساحة ، ليبقى لـ«تابع العرض» نصيب حقيقي دائماً
  const target = textRoom(m.wrap) * 0.62;
  const fit = [];
  for (const line of lines) {
    fit.push(line);
    m.box.innerHTML = renderRich(fit.join('\n'));
    if (m.box.scrollHeight > target) break;             // آخر سطر يتجاوز الحدّ يبقى في الأولى
  }
  if (fit.length === lines.length && lines.length > 2) fit.pop();   // اضمن سطراً للصفحة الثانية
  m.done();

  b1.innerHTML = renderRich(fit.join('\n'));
  b2.innerHTML = renderRich(lines.slice(fit.length).join('\n'));
}

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
