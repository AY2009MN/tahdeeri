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

/* ═══ حالة التطبيق ═══
   موضع واحد لكل ما يتشارك فيه بقيّة الكبسولات : الإعدادات ، الحصص ، التحضيرات.
   لا تُعدَّل هذه القيم إلّا عبر الدوالّ المعرّفة هنا أو في data/schedule.js. */

const CURRICULA = { '8': window.CURRICULUM_8, '9': window.CURRICULUM_9 };

let S = null;              // الإعدادات (سجل settings/app)
let grade = '9';           // الصف الحالي
let sessionsIdx = {};      // الصف ← [حصة مسطّحة]
let curIdx = 0;            // فهرس الحصة المفتوحة في المحرّر
let prepCache = {};        // معرّف الحصة ← محتواها المحرَّر
let classDates = {};       // معرّف الشعبة ← [{date, period}]
let unsaved = 0;           // تعديلات لم تُحفظ حفظاً دائماً
let saveTimer = null;

const DEFAULTS = {
  id: 'app', teacher: '', school: '', year: '٢٠٢٦/٢٠٢٧', term: 'الأول',
  start: '2026-09-14', end: '2026-12-31', fontSize: 14,
  manualMeta: false, viewMode: 'auto',        // auto | screen | a4
  sections: { logo: true, osi: true, vocab: true, media: true, evalTable: true, sign: true },
  holidays: [],
  ttVersion: 3,
  timetable: {             // يوم الأسبوع (٠ = الأحد) ورقم الحصة ـ جدول ٢٠٢٦/٢٠٢٧
    '8': [{ d: 0, p: 4 }, { d: 1, p: 2 }, { d: 2, p: 3 }, { d: 3, p: 1 }, { d: 4, p: 4 }],
    '9': [{ d: 0, p: 5 }, { d: 1, p: 4 }, { d: 2, p: 2 }, { d: 3, p: 2 }, { d: 4, p: 2 }]
  }
};

/* ── الوصول إلى الحصص والتحضيرات ── */
const sessions = () => sessionsIdx[grade] || [];
const curSession = () => sessions()[curIdx];
const prepOf = s => prepCache[s.id] || {};
const prepFor = s => prepCache[s.id] || (prepCache[s.id] = { id: s.id });

/** محضَّرة : جاهزة في المنهج أو عدّلها المعلّم */
const isDone = s => s.ready || s.status === 'prepped';

/** هل عنصر القالب مفعَّل في الإعدادات؟ */
const sectionOn = k => !S.sections || S.sections[k] !== false;

/** الشعبة المختارة ـ لكلّ شعبة جدولها وتواريخها ، والتحضير مشترك بين شعب الصف */
const curClass = () => (S.classes || []).find(c => c.id === S.cls) || (S.classes || [])[0];

/* ── الحفظ ── */
/** يحفظ التحضير بعد توقّف الكتابة بلحظة ، ويحدّث مؤشّر الحفظ */
function markDirty(s) {
  const st = byId('saveState');
  if (st) { st.textContent = 'جارٍ الحفظ…'; st.classList.add('dirty'); }
  overflowSoon();                           // حارس التجاوز يتابع الكتابة لحظةً بلحظة
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await DB.put('preps', prepCache[s.id]);
    s.status = 'prepped';
    await DB.put('sessions', { id: s.id, date: s.date, period: s.period, status: 'prepped' });
    if (DB.noStore) {                       // لا حفظ دائم : نعدّ التعديلات غير المؤمَّنة
      unsaved++;
      if (st) { st.textContent = `${ar(unsaved)} تعديل غير محفوظ`; st.classList.add('dirty'); }
    } else if (st) {
      st.textContent = 'محفوظ'; st.classList.remove('dirty');
    }
    refreshStats();
  }, 400);
}

async function persistSessions() {
  for (const gid of Object.keys(sessionsIdx))
    for (const s of sessionsIdx[gid])
      await DB.put('sessions', { id: s.id, date: s.date || null,
                                 period: s.period || null, status: s.status || 'planned' });
}

async function loadSessions() {
  const rows = await DB.all('sessions');
  const map = Object.fromEntries(rows.map(r => [r.id, r]));
  for (const gid of Object.keys(sessionsIdx))
    for (const s of sessionsIdx[gid]) {
      const r = map[s.id];
      if (r) { s.date = r.date; s.period = r.period; s.status = r.status; }
    }
}

/** حفظ نسخة كاملة في ملف ـ مخرج الطوارئ حين يتعذّر الحفظ الدائم */
async function saveToFile(kind) {
  const data = await DB.dump();
  data.kind = kind || 'نسخة';
  const now = new Date();
  const stamp = iso(now) + '_' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = `${kind === 'مسودة' ? 'مسودة' : 'نسخة'}_دفتر_التحضير_${stamp}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  unsaved = 0;
  const st = byId('saveState');
  if (st) { st.textContent = 'حُفظ في ملف'; st.classList.remove('dirty'); }
}
