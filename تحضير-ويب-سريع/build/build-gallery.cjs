/* يبني فهرس صور الكتاب : اسم الملف ← الصف والدرس ووصف عربي.
   يُشغَّل عند إضافة صور جديدة إلى مجلد img :
       node build/build-gallery.cjs                                      */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const AR = '٠١٢٣٤٥٦٧٨٩';
const ar = n => String(n).replace(/\d/g, d => AR[+d]);

const KEYS = {
  ex: 'مثال', d: 'شكل توضيحي', t: 'جدول', fahmak: 'عبّر عن فهمك', qaeda: 'قاعدة',
  q: 'سؤال', istakshif: 'استكشف', tarif: 'تعريف', hal: 'الحل', mulahaza: 'ملاحظة',
  khawas: 'خواصّ', dawrak: 'دورك الآن', u: 'وحدة', mawdooi: 'سؤال موضوعي',
  halat: 'حالات', turuq: 'طرق', taamim: 'تعميم', ruju: 'مراجعة', jadwal: 'جدول',
  khat: 'خطّ الأعداد', mukhatat: 'مخطّط', khutuwat: 'خطوات', rule: 'قاعدة',
  tawdih: 'توضيح', anwa: 'أنواع', absat: 'أبسط صورة', tawzi: 'توزيع',
  p: 'صفحة',            // لقطة صفحة من الكتاب ـ مولَّدة آلياً
  farq: 'الفرق', tasawi: 'التساوي', ittihad: 'الاتحاد', taqatu: 'التقاطع'
};

const label = key => {
  const base = key.replace(/[0-9]+[a-z]*$/, '');
  const num = (key.match(/([0-9]+)/) || [])[1];
  return (KEYS[base] || 'شكل من الكتاب') + (num ? ' ' + ar(num) : '');
};

/* الأنماط المقبولة :
     g8-2-3_ex1.png   g9_u1_l5_ex2.png   g9_l1-1_ex1.png   g8-2-t_q14.png   g8-rev_u1.png */
const RE_LESSON = /^g([89])[-_][ul]?(\d+)[-_][ul]?([0-9a-z]+)_(.+)\.png$/i;
const RE_OTHER = /^g([89])[-_](rev|t\d+)_(.+)\.png$/i;

function parse(file) {
  let m = file.match(RE_LESSON);
  if (m) return { g: m[1], unit: m[2], lesson: m[3], key: m[4] };
  m = file.match(RE_OTHER);
  if (m) return { g: m[1], unit: m[2], lesson: '', key: m[3] };
  return null;
}

/* رموز دروس المنهج ـ إليها تُنسب الصور ، فما لا يطابقها لا يصل إليه المعلّم */
global.window = {};
eval(fs.readFileSync(path.join(ROOT, 'js/data/curriculum8.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/data/curriculum9.js'), 'utf8'));
const KNOWN = { 8: [], 9: [] };
for (const g of ['8', '9'])
  global.window['CURRICULUM_' + g].units.forEach(u => u.lessons.forEach(l => KNOWN[g].push(l.code)));

/** رمز الدرس كما هو في ملفات المنهج : «٢ ـ ٣» ، «تقويم ٢» ، «مراجعة».
    أسئلة التقويم تُسمّى أحياناً برقم درس يلي آخر دروس الوحدة (g8-4-6_obj1)
    بدل الحرف t ، فلا يوجد لها درس فتضيع الصورة. فما لم يطابق درساً في
    المنهج نردّه إلى تقويم وحدته إن وُجد. */
function code(p) {
  if (p.unit === 'rev' || /^t\d+$/.test(p.unit)) return 'مراجعة';
  if (p.lesson === 't') return `تقويم ${ar(p.unit)}`;
  const direct = `${ar(p.unit)} ـ ${ar(p.lesson)}`;
  if (KNOWN[p.g].includes(direct)) return direct;
  const review = `تقويم ${ar(p.unit)}`;
  return KNOWN[p.g].includes(review) ? review : direct;
}

const out = { 8: {}, 9: {} };
let n = 0, skipped = [];
for (const f of fs.readdirSync(path.join(ROOT, 'img')).sort()) {
  if (!/\.png$/i.test(f)) continue;
  const p = parse(f);
  if (!p) { skipped.push(f); continue; }
  (out[p.g][code(p)] ||= []).push({ f, t: label(p.key) });
  n++;
}

fs.writeFileSync(path.join(ROOT, 'js/data/gallery.js'),
  '/* فهرس صور الكتاب ـ مولَّد آلياً بـ build/build-gallery.cjs ، لا يُحرَّر يدوياً */\n' +
  'window.BOOK_GALLERY = ' + JSON.stringify(out).replace(/\},"/g, '},\n  "') + ';\n', 'utf8');

if (skipped.length) console.warn('تُجوهلت أسماء غير مطابقة :', skipped.join(' '));
console.log(`فُهرست ${n} صورة في js/data/gallery.js`);
