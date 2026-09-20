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
