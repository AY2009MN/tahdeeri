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
