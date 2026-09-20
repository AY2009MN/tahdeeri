/* ═══ أدوات مشتركة : الأرقام العربية ، التواريخ ، الحماية من الوسوم ، اختصارات الوصول ═══ */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const ar = n => String(n).replace(/\d/g, d => AR_DIGITS[+d]);
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayISO = () => iso(new Date());

const fmtDate = s => {
  if (!s) return '……';
  const d = parseISO(s);
  return `${DAYS[d.getDay()]} ${ar(d.getDate())}/${ar(d.getMonth() + 1)}/${ar(d.getFullYear())}`;
};

/** أسبوع يبدأ بالأحد ويضمّ التاريخ المعطى */
function weekOf(date = new Date()) {
  const start = new Date(date);
  start.setDate(start.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); return iso(d);
  });
}

const esc = t => String(t ?? '').replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* عزل ثنائي الاتجاه للمقادير الرياضية :
   داخل فقرة عربية تُعدّ رموز مثل √ و − محايدةً ، فينقلها محرّك الاتجاه إلى يمين الرقم
   فيظهر «√٦٤» بصورة «٦٤√». لفّها في <bdi dir="ltr"> يثبّت ترتيبها على الشاشة وفي الطباعة. */
const NUM = '[٠-٩0-9]';
const MATH_RE = new RegExp(
  `([√∛]\\s*${NUM}+(?:\\s*\\/\\s*${NUM}+)?` +               // جذر تربيعي أو تكعيبي
  `|−\\s*${NUM}+(?:[٫.,]${NUM}+)?(?:\\s*\\/\\s*${NUM}+)?` + // عدد سالب
  `|${NUM}+\\s*[⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+` +                         // قوى وأسس
  `|${NUM}+\\s*[×÷]\\s*${NUM}+)`, 'g');                      // ضرب وقسمة
const mathWrap = html => html.replace(MATH_RE, '<bdi dir="ltr">$1</bdi>');

/* ── اختصارات الوصول إلى العناصر ── */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
const byId = id => document.getElementById(id);

/** يربط حدثاً إن وُجد العنصر ـ يجنّبنا فحص null في كلّ سطر */
function bind(id, ev, fn) { const e = byId(id); if (e) e[ev] = fn; return e; }

/** يضبط قيمة حقل إن وُجد */
const setVal = (id, v) => { const e = byId(id); if (e) e.value = v ?? ''; };

/** يضبط نصّ عنصر إن وُجد */
const setText = (id, v) => { const e = byId(id); if (e) e.textContent = v; };

/* ── رسالة عابرة ── */
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast no-print';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 1800);
  setTimeout(() => t.remove(), 2300);
}

/** شريط تنبيه أعلى التطبيق */
function banner(html, kind) {
  const d = document.createElement('div');
  d.className = 'banner no-print ' + (kind || '');
  d.innerHTML = html;
  document.body.insertBefore(d, document.body.firstChild.nextSibling);
  return d;
}

/** يؤجّل التنفيذ حتى تهدأ الأحداث (تغيير المقاس ، الكتابة …) */
function debounce(fn, ms) {
  let t = 0;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* الحدّ نفسه المستعمل في css/responsive.css لإرساء الاستوديو بجانب الورقة */
const isWide = () => window.matchMedia('(min-width:1000px)').matches;
