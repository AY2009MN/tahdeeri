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
/* يعدّ الصناديق الممتلئة بمقاس A4 الحقيقيّ ـ ولو كان المعروض «وضع الشاشة».
   ‎#printArea‎ ورقةٌ بمقاس A4 دائماً ، فنرسم فيها نسخةً ونقيس عليها. وبهذا
   يرى المعلّم تحذير التجاوز وهو يكتب على الهاتف ، لا بعد الطباعة. */
function countFullBoxes(root) {
  let n = 0;
  $$('.sectwrap, .sectbox:not(.nb)', root).forEach(b => {
    if (b.scrollHeight > b.clientHeight + 4) n++;
  });
  return n;
}

async function overflowInA4() {
  const s = curSession(); if (!s) return 0;
  const host = byId('printArea');
  // مقاس الخطّ موضوعٌ على ‎#paper‎ نفسه ، فلولا نقله لقيست النسخة بخطٍّ آخر
  host.style.setProperty('--sheetfs', (S.fontSize || 14) + 'px');
  host.innerHTML = $('#paper').innerHTML;                 // ما يراه المعلّم الآن
  await hydrateAssets(host);
  await imagesReady(host, 900);
  fitAllBoxes(false, host);                               // كما يجري قبل الطباعة تماماً
  const n = countFullBoxes(host);
  host.innerHTML = '';
  return n;
}

function checkOverflow() {
  const info = byId('pagesInfo');
  const screen = effectiveMode() === 'screen';
  let over = 0;
  if (!screen) {
    $$('#paper .sectwrap, #paper .sectbox:not(.nb)').forEach(b => {
      const bad = b.scrollHeight > b.clientHeight + 4;
      if (bad) over++;
      b.classList.toggle('overflowwarn', bad);
    });
  } else {
    // في وضع الشاشة تتمدّد الصناديق ، فنقيس على نسخةٍ بمقاس A4
    overflowInA4().then(n => {
      if (!info) return;
      info.textContent = n
        ? `⚠ ${ar(n)} صندوقاً يتجاوز الصفحة ـ ما زاد لن يُطبع`
        : 'وضع الشاشة ـ الطباعة صفحتان A4 ✓';
      info.classList.toggle('dirty', !!n);
    });
    return;
  }
  if (!info) return;
  info.textContent = over
    ? `⚠ ${ar(over)} صندوقاً يتجاوز الصفحة ـ صغّر صورة أو انقلها إلى «تابع العرض»`
    : 'الطباعة مطابقة للمعاينة ـ صفحتان ✓';
  info.classList.toggle('dirty', over > 0);
}

/* فحصٌ مؤجَّل يُستدعى من markDirty عند كلّ تعديل ، فيرى المعلّم التجاوز وهو
   يكتب لا بعد الطباعة. مؤجَّلٌ لأنّ قياس النسخة A4 أثقل من أن يجري كلّ حرف. */
const overflowSoon = debounce(() => { if (curSession()) checkOverflow(); }, 500);

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
  // لا يبقى عنوانٌ آخرَ الصفحة الأولى وقد ذهب ما تحته إلى الثانية
  while (fit.length > 1 && /^##/.test(fit[fit.length - 1])) fit.pop();
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

/** يصغّر صور صندوق واحد حتى يتّسع. يعيد 'ok' أو 'stuck' أو 'skip'.
    مسحٌ تنازلي لا بحثٌ ثنائي : الصور تُرصف بجانب بعضها ، فتضييقها قد يدفع
    صورةً إلى سطرٍ جديد فيزيد الارتفاع بدل أن ينقص ـ والمنحنى ليس مطّرداً ،
    فالبحث الثنائي كان يحكم بالعجز لأنّ أصغر حجمٍ وحده لم يكفِ. */
function fitOneBox(w, persist) {
  const inls = $$('.inl', w);
  const gap = () => w.scrollHeight - w.clientHeight;
  if (gap() <= 2) return 'skip';
  if (!inls.length) return 'stuck';

  const base = inls.map(sp => +sp.dataset.w || parseFloat(sp.style.width) || 90);
  const apply = f => inls.forEach((sp, i) =>
    sp.style.width = Math.max(18, base[i] * f).toFixed(1) + '%');

  let best = 1, least = Infinity, ok = false;
  for (let f = 0.95; f >= 0.25; f -= 0.05) {
    apply(f);
    const d = gap();
    if (d <= 2) { best = f; ok = true; break; }      // أوّل حجمٍ يتّسع هو أكبرها
    if (d < least) { least = d; best = f; }          // وإلّا أقلّها تجاوزاً
  }
  apply(best);
  if (persist) inls.forEach(sp => { sp.dataset.w = Math.round(parseFloat(sp.style.width)); });
  return ok ? 'ok' : 'stuck';
}

/* آخرُ ما يُحاوَل : إن بقي «العرض» ممتلئاً بعد تصغير الصور ، فالنصّ نفسه هو
   الفائض ـ لا الصور. نُنزل آخر عناصره إلى «تابع العرض» في الصفحة الثانية
   عنصراً عنصراً حتى يتّسع ، فلا يُقصّ سطرٌ في الطباعة من غير أن يدري أحد.
   (قياس flowShow يجري قبل تحميل الصور ، فلا يرى ارتفاعها ـ وهذا تصحيحه) */
function reflowOverflow(persist, scope) {
  const root = scope || byId('paper');
  const b1 = $('.sectbox[data-f="show"]', root);
  const b2 = $('.sectbox[data-f="show2"]', root);
  if (!b1 || !b2) return 0;
  const w = b1.closest('.sectwrap') || b1;
  const over = () => b1.scrollHeight > b1.clientHeight + 2 || w.scrollHeight > w.clientHeight + 2;
  let moved = 0;
  const w2 = b2.closest('.sectwrap') || b2;
  const over2 = () => b2.scrollHeight > b2.clientHeight + 2 || w2.scrollHeight > w2.clientHeight + 2;
  /* لا نحلّ ضيق الصفحة الأولى بإغراق الثانية : إن فاضت هي الأخرى رددنا العنصر ،
     فيبقى الفائض حيث تنفع معه الصور تصغيراً ، ويبقى التحذير صادقاً. */
  while (over() && b1.children.length > 1 && moved < 60) {
    const el = b1.lastElementChild;
    b2.insertBefore(el, b2.firstChild);
    // إن ضاقت الثانية بما نزل إليها صغّرنا صورها لتتّسع ، فإن عجزت رددناه
    if (over2() && fitOneBox(w2, persist) !== 'ok') { b1.appendChild(el); break; }
    moved++;
  }
  /* والعكس : إن فاض «تابع العرض» والصفحة الأولى فيها متّسع ، رفعنا إليها أوّل
     عناصره ـ فالقسمة الأولى تقع قبل تحميل الصور فتُثقل الثانية بلا داعٍ. */
  while (over2() && b2.children.length > 1 && moved < 60) {
    const el = b2.firstElementChild;
    b1.appendChild(el);
    if (over()) { b2.insertBefore(el, b2.firstChild); break; }   // لا متّسع ـ نردّه
    moved++;
  }
  if (moved && persist) [b1, b2].forEach(b => b.dispatchEvent(new Event('input', { bubbles: true })));
  return moved;
}

/** يمرّ على صناديق الورقة ويعيد {fixed, stuck} */
function fitAllBoxes(persist, scope) {
  const root = scope || byId('paper');
  let fixed = 0, stuck = 0;
  $$('.sectwrap', root).forEach(w => {
    const r = fitOneBox(w, persist);
    if (r === 'ok') fixed++;
    if (r === 'stuck') stuck++;
    if (persist && r !== 'skip') {
      const box = $('[contenteditable][data-f]', w);
      if (box) box.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  if (stuck && reflowOverflow(persist, root)) {    // نزلَ الفائض إلى الصفحة الثانية
    stuck = 0;
    $$('.sectwrap', root).forEach(w => { if (w.scrollHeight > w.clientHeight + 2) stuck++; });
  }
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
