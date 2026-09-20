/* ═══ الترميز المبسّط داخل أقسام الورقة ═══
   يُكتب في ملفات المنهج أو يكتبه المعلّم فيتحوّل إلى تنسيق :
     ## عنوان فرعي            ← عنوان أزرق عريض
     == تعريف ==              ← تظليل أصفر
     !! ملاحظة | بند | بند    ← صندوق ملاحظة بنقاط
     >> لاحظ ما يلي …         ← سطر تنبيه أحمر
     {حب استطلاع}             ← وسم مهارة أو قيمة
     ص(٢١) أو ص٢١             ← مرجع صفحة بالأحمر
     [[img:img/x.png|48]]     ← صورة من الكتاب
     [[slot:مثال (١)]]        ← موضع إدراج جاهز                            */

const CHIPS = { 'حب استطلاع': '', 'التفكير': 'v2', 'إنجاز': 'v3', 'انجاز': 'v3' };

/** صندوق «ملاحظة» بعنوان ونقاط */
function richNote(raw) {
  const parts = raw.replace(/^!!\s*/, '').split('|').map(x => x.trim()).filter(Boolean);
  const head = parts.shift() || 'ملاحظة :';
  return `<div class="notebox"><b>${esc(head)}</b><div><ul>${
    parts.map(p => `<li>${mathWrap(esc(p))}</li>`).join('')}</ul></div></div>`;
}

/** سطر عاديّ : الوسوم الداخلية ثم الصور والمواضع */
function richLine(raw) {
  let l = mathWrap(esc(raw));
  l = l.replace(/\{\{([^}]+)\}\}/g, '<span class="tm">$1</span>');   // الزمن قبل وسوم المهارات
  l = l.replace(/==([^=]+)==/g, '<span class="deftag">$1</span>');
  l = l.replace(/\{([^}]+)\}/g, (m, t) =>
    `<span class="chip ${CHIPS[t.trim()] ?? ''}">${esc(t.trim())}</span>`);
  l = l.replace(/(ص\s*\(?\s*[٠-٩0-9]+\s*\)?)(?![^\[]*\]\])/g, '<span class="ref">$1</span>');
  return `<div>${inlInline(l)}</div>`;
}

function renderRich(text) {
  if (/<[a-z]/i.test(text)) return text;            // محتوى منسَّق سابقاً ـ يُعرض كما هو
  return text.split('\n').map(raw => {
    const row = inlTokens(raw);                     // سطر صور ← صفّ منتظم
    if (row) return row;
    if (/^\s*$/.test(raw)) return '<div class="gap"></div>';
    if (/^!!/.test(raw)) return richNote(raw);
    if (/^##/.test(raw)) return `<div class="mini">${
      mathWrap(esc(raw.replace(/^##\s*/, ''))).replace(/\{\{([^}]+)\}\}/g, '<span class="tm">$1</span>')}</div>`;
    if (/^>>/.test(raw)) return `<div class="alert">${mathWrap(esc(raw.replace(/^>>\s*/, '')))}</div>`;
    return richLine(raw);
  }).join('');
}

/* ═══ مواضع الإدراج للوحدات غير المكتملة ═══
   كل سطر يبدأ بمثال / دورك الآن / تمارين ذاتية / عبّر عن فهمك / استكشف / حلّ وناقش
   يتحوّل إلى «مكان إدراج» ، فيملؤه المعلّم بلقطة من صفحات الدرس بنقرة واحدة. */
const SLOT_HEADS = [
  /^مناقشة\s+(اِ?ستكشِ?ف|حُ?لّ?\s*و\s*ناقِ?ش)/, /^(اِ?ستكشِ?ف|حُ?لّ?\s*وناقِ?ش)/,
  /^مثال/, /^دورك الآن/, /^تمارين ذاتية|^تمرين ذاتي/, /^عبّر عن فهمك/
];

function slotify(text) {
  if (!text || /\[\[|<[a-z]/i.test(text)) return text || '';
  const out = [];
  for (const line of text.split('\n')) {
    // خطوات الحلّ تُلتقط من الكتاب ، فلا تُكتب نصّاً
    if (/^\s{2,}|^\s*[•◂⟵]/.test(line) || /^\s*الحل\s*:?\s*$/.test(line)) continue;
    const t = line.trim().replace(/^[◼▪■]\s*/, '');
    if (!SLOT_HEADS.some(re => re.test(t))) { out.push(t); continue; }
    const cut = t.search(/\s*:\s/);
    out.push(`[[slot:${(cut > 0 && cut < 40 ? t.slice(0, cut) : t).trim()}]]`);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* أسماء عناصر القالب في شاشة الإعدادات */
const SECTION_LABELS = {
  logo: 'شعار المدرسة',
  osi: 'نواتج التعلم والمعيار والمؤشرات',
  vocab: 'العبارات والمفردات',
  media: 'الوسائل التعليمية',
  evalTable: 'جدول التقويم',
  sign: 'سطر توقيع المعلّم'
};
