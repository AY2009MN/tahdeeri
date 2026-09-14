/* ===== دفتر التحضير — منطق التطبيق ===== */

/* ────────── أدوات عربية ────────── */
const AR = '٠١٢٣٤٥٦٧٨٩';
const ar = n => String(n).replace(/\d/g, d => AR[+d]);
const DAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseISO = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const fmtDate = s => { if(!s) return '……'; const d = parseISO(s);
  return `${DAYS[d.getDay()]} ${ar(d.getDate())}/${ar(d.getMonth()+1)}/${ar(d.getFullYear())}`; };
const esc = t => String(t ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

/* عزل ثنائي الاتجاه للمقادير الرياضية:
   داخل فقرة عربية تُعدّ رموز مثل √ و − محايدةً، فينقلها محرّك الاتجاه إلى يمين الرقم
   ويظهر «√٦٤» بصورة «٦٤√». لفّها في <bdi dir="ltr"> يثبّت ترتيبها الصحيح على الشاشة وفي الطباعة. */
const D = '[٠-٩0-9]';
const MATHRE = new RegExp(
  `([√∛]\\s*${D}+(?:\\s*\\/\\s*${D}+)?` +            // جذر تربيعي أو تكعيبي
  `|−\\s*${D}+(?:[٫.,]${D}+)?(?:\\s*\\/\\s*${D}+)?` + // عدد سالب
  `|${D}+\\s*[⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+` +                    // قوى وأسس
  `|${D}+\\s*[×÷]\\s*${D}+)`, 'g');                   // ضرب وقسمة
const mathWrap = html => html.replace(MATHRE, '<bdi dir="ltr">$1</bdi>');

/* ────────── ترميز مبسّط داخل أقسام الورقة ──────────
   يُكتب في ملفات المنهج (أو يكتبه المعلّم) فيتحوّل إلى تنسيق:
     ## عنوان فرعي            ← عنوان أزرق عريض
     == تعريف ==              ← تظليل أصفر للتعريف
     !! ملاحظة | بند | بند    ← صندوق «ملاحظة» بنقاط
     >> لاحظ ما يلي …         ← سطر تنبيه أحمر
     {حب استطلاع}             ← وسم مهارة/قيمة في آخر السطر
     ص(٢١) أو ص٢١             ← يُبرز مرجع الصفحة بالأحمر                           */
const CHIPS = { 'حب استطلاع':'', 'التفكير':'v2', 'إنجاز':'v3', 'انجاز':'v3' };
function renderRich(text) {
  if (/<[a-z]/i.test(text)) return text;               // محتوى منسَّق سابقاً ـ يُعرض كما هو
  return text.split('\n').map(raw => {
    const row = inlTokens(raw);                        // سطر صور ← صفّ منتظم
    if (row) return row;
    let l = mathWrap(esc(raw));
    if (/^\s*$/.test(raw)) return '<div class="gap"></div>';
    if (/^!!/.test(raw)) {
      const parts = raw.replace(/^!!\s*/, '').split('|').map(x => x.trim()).filter(Boolean);
      const head = parts.shift() || 'ملاحظة :';
      return `<div class="notebox"><b>${esc(head)}</b><div><ul>${
        parts.map(p => `<li>${mathWrap(esc(p))}</li>`).join('')}</ul></div></div>`;
    }
    if (/^##/.test(raw)) return `<div class="mini">${mathWrap(esc(raw.replace(/^##\s*/,''))).replace(/\{\{([^}]+)\}\}/g, '<span class="tm">$1</span>')}</div>`;
    if (/^>>/.test(raw)) return `<div class="alert">${mathWrap(esc(raw.replace(/^>>\s*/,'')))}</div>`;
    // زمن البند {{٥ د}} يُعالَج قبل وسوم المهارات {…} حتى لا تبتلعه
    l = l.replace(/\{\{([^}]+)\}\}/g, '<span class="tm">$1</span>');
    l = l.replace(/==([^=]+)==/g, '<span class="deftag">$1</span>');
    l = l.replace(/\{([^}]+)\}/g, (m, t) =>
      `<span class="chip ${CHIPS[t.trim()] ?? ''}">${esc(t.trim())}</span>`);
    l = l.replace(/(ص\s*\(?\s*[٠-٩0-9]+\s*\)?)(?![^\[]*\]\])/g, '<span class="ref">$1</span>');
    return `<div>${inlInline(l)}</div>`;
  }).join('');
}

const SECTION_LABELS = {
  logo: 'شعار المدرسة',
  osi: 'نواتج التعلم والمعيار والمؤشرات',
  vocab: 'العبارات والمفردات',
  media: 'الوسائل التعليمية',
  evalTable: 'جدول التقويم',
  sign: 'سطر توقيع المعلّم'
};

/* ────────── الحالة ────────── */
const CURRICULA = { '8': window.CURRICULUM_8, '9': window.CURRICULUM_9 };
let S = null;                 // الإعدادات
let grade = '9';              // الصف الحالي
let sessionsIdx = {};         // grade -> [حصة مسطّحة]
let curIdx = 0;               // فهرس الحصة المفتوحة في المحرّر
let prepCache = {};           // id -> محتوى محرَّر
let saveTimer = null;

const DEFAULTS = {
  id: 'app', teacher: '', school: '', year: '٢٠٢٦/٢٠٢٧', term: 'الأول',
  start: '2026-09-15', end: '2026-12-31', fontSize: 14,
  sections: { logo:true, osi:true, vocab:true, media:true, evalTable:true, sign:true },
  holidays: [],
  ttVersion: 2,
  timetable: {                // weekday(0=الأحد) + رقم الحصة ـ جدول ٢٠٢٦/٢٠٢٧
    '8': [{d:0,p:4},{d:1,p:2},{d:2,p:3},{d:3,p:1},{d:4,p:4}],
    '9': [{d:0,p:5},{d:1,p:4},{d:2,p:2},{d:3,p:2},{d:4,p:2}]
  }
};

/* ────────── مواضع الإدراج للوحدات غير المكتملة ──────────
   كل سطر يبدأ بمثال / دورك الآن / تمارين ذاتية / عبّر عن فهمك / استكشف / حلّ وناقش
   يتحوّل إلى «مكان إدراج» مع زمنه ، فيملؤه المعلّم بلقطة من صفحات الدرس بنقرة واحدة. */
const SLOT_TIMES = [
  [/^مناقشة\s+(اِ?ستكشِ?ف|حُ?لّ?\s*و\s*ناقِ?ش)/, 5], [/^(اِ?ستكشِ?ف|حُ?لّ?\s*وناقِ?ش)/, 5],
  [/^مثال/, 7], [/^دورك الآن/, 5], [/^تمارين ذاتية|^تمرين ذاتي/, 5], [/^عبّر عن فهمك/, 4]
];
function slotify(text) {
  if (!text || /\[\[|<[a-z]/i.test(text)) return text || '';
  const out = [];
  for (const line of text.split('\n')) {
    if (/^\s{2,}|^\s*[•◂⟵]/.test(line) || /^\s*الحل\s*:?\s*$/.test(line)) continue;   // خطوات الحلّ تُلتقط من الكتاب
    const t = line.trim().replace(/^[◼▪■]\s*/, '');
    const hit = SLOT_TIMES.find(([re]) => re.test(t));
    if (!hit) { out.push(t); continue; }
    const cut = t.search(/\s*:\s/);
    const label = (cut > 0 && cut < 40 ? t.slice(0, cut) : t).trim();
    out.push(`[[slot:${label}]] {{${ar(hit[1])} د}}`);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ────────── تسطيح المنهج إلى حصص ────────── */
function flatten(gid) {
  const cur = CURRICULA[gid]; const out = [];
  cur.units.forEach(u => u.lessons.forEach(l => l.sessions.forEach((s, i) => {
    out.push({
      id: `${gid}|${out.length}`, n: out.length,
      gradeId: gid, gradeName: cur.name, section: cur.section,
      unitNo: u.no, unitTitle: u.title, standard: u.standard, indicators: u.indicators,
      code: l.code, title: l.title, pages: l.pages, outcomes: l.outcomes,
      vocab: l.vocab, media: l.media || [],
      partIdx: i + 1, partOf: l.sessions.length,
      focus: s.focus,
      intro: u.ready ? s.intro : slotify(s.intro),
      show:  u.ready ? s.show  : slotify(s.show),
      show2: u.ready ? (s.show2 || '') : slotify(s.show2 || ''),
      close: s.close,
      evalx: s.evalx, worksheet: s.worksheet || null, figs: s.figs || []
    });
  })));
  return out;
}

/* ────────── توليد التواريخ ────────── */
function generateDates() {
  const hol = new Set(S.holidays.map(h => h.date));
  const startAll = parseISO(S.start), endAll = parseISO(S.end);
  const report = {};
  for (const gid of Object.keys(CURRICULA)) {
    const slots = (S.timetable[gid] || []).slice().sort((a,b) => a.d - b.d || a.p - b.p);
    const list = sessionsIdx[gid];
    let placed = 0;
    if (!slots.length) { report[gid] = 0; continue; }
    const d = new Date(startAll);
    while (placed < list.length && d <= endAll) {
      const wd = d.getDay();
      if (wd !== 5 && wd !== 6 && !hol.has(iso(d))) {           // تخطّي الجمعة والسبت والعطل
        for (const sl of slots.filter(x => x.d === wd)) {
          if (placed >= list.length) break;
          list[placed].date = iso(d);
          list[placed].period = sl.p;
          placed++;
        }
      }
      d.setDate(d.getDate() + 1);
    }
    for (let i = placed; i < list.length; i++) { list[i].date = null; list[i].period = null; }
    report[gid] = placed;
  }
  return report;
}

/** auto = توليد تلقائي عند الإقلاع (لا يُختم بوقت ، فلا يمحو حالة «محضَّرة» القادمة من جهاز آخر) */
async function persistSessions(auto) {
  for (const gid of Object.keys(sessionsIdx))
    for (const s of sessionsIdx[gid]) {
      const row = { id: s.id, date: s.date || null, period: s.period || null, status: s.status || 'planned' };
      await (auto ? DB.putRaw('sessions', { ...row, ts: 0 }) : DB.put('sessions', row));
    }
}

/** بعد وصول تعديلات من جهاز آخر: إعادة تحميل البيانات وتحديث الشاشة المفتوحة */
window.reloadFromDB = async function () {
  S = (await DB.get('settings', 'app')) || S;
  prepCache = {};
  (await DB.all('preps')).forEach(p => prepCache[p.id] = p);
  await loadSessions();
  const typing = document.activeElement && document.activeElement.closest('#paper [contenteditable]');
  const v = document.querySelector('.view:not(.hidden)');
  if (!v || typing || saveTimer) return;
  show(v.id.replace('view-', ''));
};

async function loadSessions() {
  const rows = await DB.all('sessions');
  const map = Object.fromEntries(rows.map(r => [r.id, r]));
  for (const gid of Object.keys(sessionsIdx))
    for (const s of sessionsIdx[gid]) {
      const r = map[s.id];
      if (r) { s.date = r.date; s.period = r.period; s.status = r.status; }
    }
}

/* ────────── بناء ورقة A4 ────────── */
const FIELDS = ['intro','show','close','evalx','vocab','mediaExtra'];

function prepOf(s) { return prepCache[s.id] || {}; }

const on = k => !S.sections || S.sections[k] !== false;

function sheetHTML(s) {
  const p = prepOf(s);
  const v = (k, fb) => (p[k] !== undefined && p[k] !== null && p[k] !== '') ? p[k] : (fb ?? '');
  const media = s.media.slice(0, 3);
  while (media.length < 3) media.push('اختيار عنصر.');

  const headRows = [1,2,3].map(i => i === 1
    ? `<tr><td class="valb">${fmtDate(s.date)}</td><td class="valb">${esc(s.section)}</td><td class="valb">${s.period?ar(s.period):'……'}</td></tr>`
    : `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('');

  const evalRows = [1,2,3].map(() =>
    `<tr><td contenteditable>&nbsp;</td><td contenteditable>&nbsp;</td><td contenteditable>&nbsp;</td><td contenteditable>&nbsp;</td><td contenteditable>&nbsp;</td></tr>`).join('');

  return `
  <!-- ═════ الصفحة ١ ═════ -->
  <div class="sheet" data-page="1">
    <div class="hdrwrap">
      <table>
        <tr><td class="lbl">اليوم والتاريخ</td><td class="lbl">الصف</td><td class="lbl">الحصة</td></tr>
        ${headRows}
      </table>
      ${on('logo') ? '<div class="logobox"><img src="icons/logo.png" alt="" onerror="this.style.display=&quot;none&quot;"></div>' : ''}
    </div>

    <table style="margin-top:2mm">
      <tr>
        <td class="lbl" style="width:13%">الوحدة</td><td class="lbl" style="width:30%">المجال</td>
        <td class="lbl" style="width:16%">البند</td><td class="lbl" style="width:41%">عنوان الدرس</td>
      </tr>
      <tr>
        <td class="val">${esc(s.unitNo)}</td><td class="val">${esc(s.unitTitle)}</td>
        <td class="val">${esc(s.code)}</td><td class="val">${esc(s.title)}</td>
      </tr>
    </table>

    ${on('osi') ? `<table style="margin-top:1mm">
      <tr><td class="lbl" style="width:34%">نواتج التعلم</td>
          <td class="lbl" style="width:33%">المعيار</td>
          <td class="lbl" style="width:33%">مؤشرات الأداء</td></tr>
      <tr style="height:16mm">
        <td class="cellin" contenteditable data-f="outcomes">${mathWrap(esc(v('outcomes', s.outcomes)))}</td>
        <td class="cellin" contenteditable data-f="standard">${mathWrap(esc(v('standard', s.standard)))}</td>
        <td class="cellin" contenteditable data-f="indicators">${mathWrap(esc(v('indicators', s.indicators)))}</td>
      </tr>
    </table>` : ''}

    ${on('vocab') ? `<table style="margin-top:1mm">
      <tr><td class="lbl" style="width:22%">العبارات والمفردات :</td>
          <td class="cellin" contenteditable data-f="vocab">${mathWrap(esc(v('vocab', s.vocab)))}</td></tr>
    </table>` : ''}

    ${on('media') ? `<table style="margin-top:1mm">
      <tr>
        <td class="lbl" style="width:22%">الوسائل التعليمية</td>
        <td class="lbl" style="width:13%">الكتاب</td>
        <td class="cellin" contenteditable data-f="m0">${esc(media[0])}</td>
        <td class="cellin" contenteditable data-f="m1">${esc(media[1])}</td>
        <td class="cellin" contenteditable data-f="m2">${esc(media[2])}</td>
      </tr>
    </table>` : ''}

    <div class="sect" style="margin-top:3mm">
      <div class="secttl">المقدمة والتمهيد</div>
      <div class="sectwrap" style="min-height:34mm">
        <div class="sectbox nb" contenteditable data-f="intro">${renderRich(v('intro', s.intro))}</div>
        ${figsHTML(s, 'intro')}
      </div>
    </div>

    <div class="sect grow">
      <div class="secttl">العرض</div>
      <div class="sectwrap">
        <div class="sectbox nb" contenteditable data-f="show">${renderRich(v('show', s.show))}</div>
        ${figsHTML(s, 'show')}
      </div>
    </div>
  </div>

  <!-- ═════ الصفحة ٢ ═════ -->
  <div class="sheet" data-page="2">
    <div class="sect grow">
      <div class="secttl">تابع العرض</div>
      <div class="sectwrap">
        <div class="sectbox nb" contenteditable data-f="show2">${renderRich(v('show2', s.show2 || ''))}</div>
        ${figsHTML(s, 'show2')}
      </div>
    </div>

    <div class="sect">
      <div class="secttl">الخاتمة والتقييم</div>
      <div class="sectbox" contenteditable data-f="close" style="min-height:30mm">${renderRich(v('close', s.close))}</div>
    </div>

    <div class="sect">
      <div class="secttl">التقويم</div>
      <div class="sectwrap" style="min-height:30mm">
        <div class="sectbox nb" contenteditable data-f="evalx">${renderRich(v('evalx', s.evalx))}</div>
        ${figsHTML(s, 'evalx')}
      </div>
    </div>

    ${on('evalTable') ? `<table style="margin-top:2mm">
      <tr>
        <td class="lbl" style="width:10%">الصف</td>
        <td class="lbl" style="width:24%">مدى تحقق نواتج التعلم</td>
        <td class="lbl" style="width:26%">ملائمة التحضير مع زمن الحصة</td>
        <td class="lbl" style="width:26%">فعالية الوسائل التعليمية المستخدمة</td>
        <td class="lbl" style="width:14%">التطبيق</td>
      </tr>
      ${evalRows}
    </table>` : ''}

    ${on('sign') ? `<div class="sign">معلّم المادة: ${esc(S.teacher || '……………………')}</div>` : ''}
  </div>`;
}

/* ────────── ورقة العمل (٤ نسخ في A4) ────────── */
function worksheetHTML(s) {
  const w = s.worksheet;
  if (!w) return '<p class="hint" style="text-align:center">لا توجد ورقة عمل لهذه الحصة.</p>';
  const cell = `
    <div class="wcell">
      <h5>${esc(w.title)}</h5>
      <div class="meta"><span>${esc(s.gradeName)} ـ ${esc(s.section)}</span><span>${esc(s.code)} ${esc(s.title)}</span></div>
      <ol><li>${mathWrap(esc(w.q1))}</li><li>${mathWrap(esc(w.q2))}</li></ol>
      <div class="nameline">الاسم: ………………………………  التاريخ: ${fmtDate(s.date)}</div>
    </div>`;
  return `<div class="wsheet">${cell.repeat(4)}</div>`;
}

/* ────────── المحرّر ────────── */
function openEditor(gid, idx) {
  grade = gid; curIdx = idx;
  document.getElementById('gradeSel').value = gid;
  show('editor');
}

function renderEditor() {
  const list = sessionsIdx[grade];
  curIdx = Math.max(0, Math.min(curIdx, list.length - 1));
  const s = list[curIdx];
  document.getElementById('sesLabel').textContent =
    `${s.code} ${s.title} — الحصة ${ar(s.partIdx)} من ${ar(s.partOf)} · ${fmtDate(s.date)}`;
  const paper = document.getElementById('paper');
  paper.style.setProperty('--sheetfs', (S.fontSize || 14) + 'px');
  paper.innerHTML = sheetHTML(s);
  flowShow(s);                       // توزيع العرض على الصفحتين
  paper.querySelectorAll('[contenteditable][data-f]').forEach(el => {
    el.addEventListener('input', () => {
      const p = prepCache[s.id] || (prepCache[s.id] = { id: s.id });
      p[el.dataset.f] = el.classList.contains('sectbox') ? cleanHTML(el) : el.innerText;
      markDirty(s);
    });
  });
  wireFigs();
  wireInline();
  hydrateAssets(paper).then(checkOverflow);
  paper.querySelectorAll('img').forEach(im => im.complete || im.addEventListener('load', checkOverflow, { once: true }));
  checkOverflow();
}

function markDirty(s) {
  const st = document.getElementById('saveState');
  st.textContent = 'جارٍ الحفظ…'; st.classList.add('dirty');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    await DB.put('preps', prepCache[s.id]);
    s.status = 'prepped';
    await DB.put('sessions', { id: s.id, date: s.date, period: s.period, status: 'prepped' });
    if (DB.noStore) {                       // لا حفظ دائم: نعدّ التعديلات غير المؤمّنة
      unsaved++;
      st.textContent = `${ar(unsaved)} تعديل غير محفوظ`; st.classList.add('dirty');
    } else {
      st.textContent = 'محفوظ'; st.classList.remove('dirty');
    }
    refreshStats();
  }, 400);
}

/* ────────── حفظ العمل إلى ملف ────────── */
let unsaved = 0;

async function saveToFile(kind) {
  const data = await DB.dump();
  data.kind = kind || 'نسخة';
  const stamp = iso(new Date()) + '_' + String(new Date().getHours()).padStart(2,'0') + String(new Date().getMinutes()).padStart(2,'0');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = `${kind === 'مسودة' ? 'مسودة' : 'نسخة'}_دفتر_التحضير_${stamp}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  unsaved = 0;
  const st = document.getElementById('saveState');
  if (st) { st.textContent = 'حُفظ في ملف'; st.classList.remove('dirty'); }
}

/* حارس الإغلاق: يمنع ضياع العمل عندما يكون الحفظ الدائم معطّلاً */
window.addEventListener('beforeunload', e => {
  if (DB.noStore && unsaved > 0) { e.preventDefault(); e.returnValue = ''; }
});

/** صور الأمثلة: قصاصات من كتاب الطالب + أيّ صورة يدرجها المعلّم.
    المصدر إمّا مسار ملف داخل المجلد، أو صورة مخزَّنة في قاعدة البيانات كـ data URL. */


/** إدراج صورة من جهاز المعلّم في الحصة الحالية (تُضغط ثم تُحفظ داخل قاعدة البيانات) */
async function insertImage(file) {
  const s = sessionsIdx[grade][curIdx];
  const dataUrl = await shrinkImage(file, 1200, 0.8);
  const p = prepCache[s.id] || (prepCache[s.id] = { id: s.id });
  p.figs = (p.figs !== undefined ? p.figs : (s.figs || [])).concat([{ ...FIG_DEFAULTS, src: dataUrl, cap: '' }]);
  markDirty(s);
  renderEditor();
}

/** ضغط الصورة قبل الحفظ حتى لا تتضخّم قاعدة البيانات */
function shrinkImage(file, maxW, quality) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', quality));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

/** توزيع «العرض» على صفحتَي القالب:
    نملأ صندوق الصفحة الأولى سطراً سطراً حتى يمتلئ، ويُنقل الباقي إلى «تابع العرض» في الصفحة الثانية،
    فلا تبقى الصفحة الثانية فارغة ويبقى القالب متّسقاً في كل حصة. */
function flowShow(s) {
  const b1 = document.querySelector('.sectbox[data-f="show"]');
  const b2 = document.querySelector('.sectbox[data-f="show2"]');
  if (!b1 || !b2) return;
  const p = prepOf(s);
  if (p.show2 !== undefined && p.show2 !== '') return;   // المستخدم كتب في الصفحة الثانية يدوياً ـ لا نلمسها
  if (s.show2) return;                                   // الدرس يوزّع محتواه على الصفحتين بنفسه

  const lines = String((p.show !== undefined && p.show !== '') ? p.show : (s.show || '')).split('\n');
  if (lines.length < 2) { b1.innerHTML = renderRich(lines.join('\n')); b2.innerHTML = ''; return; }

  // المساحة المتاحة للنصّ = ارتفاع الصندوق ناقص ارتفاع الصور التي تشاركه الإطار،
  // فلا تُدفع الصور خارج الحدّ ولا يتجاوز المحتوى الورقة.
  const wrap  = b1.closest('.sectwrap') || b1.parentElement;
  const figsH = [...wrap.querySelectorAll('.figs')]
                  .filter(x => getComputedStyle(x).position !== 'absolute')
                  .reduce((a, x) => a + x.offsetHeight, 0);
  if (wrap.clientHeight < 60) {                       // الورقة لم تُعرض بعد ـ لا نقسّم
    b1.innerHTML = renderRich(lines.join('\n'));
    b2.innerHTML = '';
    return;
  }
  const room  = Math.max(40, wrap.clientHeight - figsH - 8);

  // نملأ الصفحة الأولى حتى ٦٢٪ من المساحة المتاحة، ليبقى لـ«تابع العرض» في الصفحة الثانية
  // نصيب حقيقي دائماً فلا تخرج ورقة بصفحة ثانية فارغة، ويبقى القالب متّسقاً بين الحصص.
  const target = room * 0.62;
  const fit = [];
  for (const line of lines) {
    fit.push(line);
    b1.innerHTML = renderRich(fit.join('\n'));
    if (b1.scrollHeight > target) break;          // آخر سطر يتجاوز الحدّ يبقى في الصفحة الأولى
  }
  if (fit.length === lines.length && lines.length > 2) fit.pop();   // اضمن سطراً للصفحة الثانية
  b1.innerHTML = renderRich(fit.join('\n'));
  b2.innerHTML = renderRich(lines.slice(fit.length).join('\n'));
}

/** تنبيه بصري عند تجاوز المحتوى ارتفاع الصندوق */
function checkOverflow() {
  document.querySelectorAll('.sectwrap, .sectbox:not(.nb)').forEach(b => {
    b.classList.toggle('overflowwarn', b.scrollHeight > b.clientHeight + 4);
  });
}

/* ────────── العروض ────────── */
function show(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + view).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  if (view === 'home') renderHome();
  if (view === 'notebook') renderNotebook();
  if (view === 'settings') renderSettings();
  if (view === 'library') renderLibrary();
  // لا بدّ من رسم الورقة عند الدخول إلى التحضير من التبويب مباشرة،
  // وإلا ظهرت صفحة فارغة حتى ينتقل المستخدم إلى حصة أخرى.
  if (view === 'editor') renderEditor();
}

function renderHome() {
  const today = new Date(); const t = iso(today);
  document.getElementById('todayGreg').textContent =
    `${DAYS[today.getDay()]} ${ar(today.getDate())}/${ar(today.getMonth()+1)}/${ar(today.getFullYear())}`;
  document.getElementById('todayLabel').textContent = S.teacher ? `أهلاً ${S.teacher}` : 'مرحباً بك';

  const all = [].concat(...Object.values(sessionsIdx));
  const todays = all.filter(s => s.date === t).sort((a,b) => (a.period||0) - (b.period||0));
  document.getElementById('todaySessions').innerHTML = todays.length
    ? todays.map(s => `<div class="card ${s.status==='prepped'?'done':''}" data-g="${s.gradeId}" data-i="${s.n}">
         <b>${esc(s.gradeName)} ـ الحصة ${ar(s.period||0)}</b>
         <small>${esc(s.code)} ${esc(s.title)}</small>
         <small>${esc(s.focus)}</small></div>`).join('')
    : '<p class="hint">لا توجد حصص اليوم (أو لم تولّد التواريخ بعد من الإعدادات).</p>';

  const start = new Date(today); start.setDate(start.getDate() - ((today.getDay()+7)%7));
  const week = [];
  for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(d.getDate()+i); week.push(iso(d)); }
  const rows = all.filter(s => week.includes(s.date))
                  .sort((a,b) => a.date.localeCompare(b.date) || (a.period||0)-(b.period||0));
  document.getElementById('weekList').innerHTML = rows.length
    ? rows.map(s => `<div class="wrow" data-g="${s.gradeId}" data-i="${s.n}">
        <span class="d">${fmtDate(s.date).split(' ')[0]} ${ar(parseISO(s.date).getDate())}</span>
        <span class="t">${esc(s.gradeName)} · ${esc(s.code)} ${esc(s.title)}</span>
        <span class="s">${s.status==='prepped'?'محضَّرة':'—'}</span></div>`).join('')
    : '<p class="hint">لا حصص هذا الأسبوع.</p>';
  refreshStats();
}

function refreshStats() {
  const list = sessionsIdx[grade] || [];
  document.getElementById('statTotal').textContent = ar(list.length);
  document.getElementById('statDone').textContent = ar(list.filter(s => s.status === 'prepped').length);
}

function renderNotebook() {
  const q = (document.getElementById('nbSearch').value || '').trim();
  const f = document.getElementById('nbFilter').value;
  const list = sessionsIdx[grade];
  const byUnit = {};
  list.forEach(s => {
    if (q && !(s.title + s.code + s.focus).includes(q)) return;
    if (f === 'done' && s.status !== 'prepped') return;
    if (f === 'todo' && s.status === 'prepped') return;
    (byUnit[s.unitNo] ||= { title: s.unitTitle, rows: [] }).rows.push(s);
  });
  document.getElementById('nbList').innerHTML = Object.entries(byUnit).map(([no, u]) => `
    <div class="nbunit"><h4>الوحدة ${esc(no)} ـ ${esc(u.title)}</h4>
      ${u.rows.map(s => `<div class="nbrow ${s.status==='prepped'?'done':''}" data-g="${s.gradeId}" data-i="${s.n}">
        <span class="n">${ar(s.n+1)}</span>
        <span class="t">${esc(s.code)} ${esc(s.title)} <small style="color:#5a6472">(${ar(s.partIdx)}/${ar(s.partOf)})</small></span>
        <span class="dt">${fmtDate(s.date)}</span></div>`).join('')}
    </div>`).join('') || '<p class="hint">لا نتائج.</p>';
}

function renderSettings() {
  stVal('stTeacher', S.teacher); stVal('stSchool', S.school);
  stVal('stYear', S.year); stVal('stTerm', S.term);
  stVal('stStart', S.start); stVal('stEnd', S.end);

  document.getElementById('timetable').innerHTML = Object.keys(CURRICULA).map(gid => `
    <div class="nbunit"><h4>${esc(CURRICULA[gid].name)} ـ ${esc(CURRICULA[gid].section)}</h4>
      <table style="width:calc(100% - 0px);border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden">
        <tr>${DAYS.slice(0,5).map(d => `<th style="padding:6px;font-size:13px;background:#f2f5f9">${d}</th>`).join('')}</tr>
        <tr>${[0,1,2,3,4].map(d => {
          const slot = (S.timetable[gid]||[]).find(x => x.d === d);
          return `<td style="padding:6px;text-align:center">
            <select data-tt="${gid}" data-d="${d}">
              <option value="">—</option>
              ${[1,2,3,4,5,6,7].map(p => `<option value="${p}" ${slot&&slot.p===p?'selected':''}>الحصة ${ar(p)}</option>`).join('')}
            </select></td>`;
        }).join('')}</tr>
      </table>
    </div>`).join('');

  renderSections();
  Sync.renderPanel();
  document.getElementById('holList').innerHTML = S.holidays.map((h,i) =>
    `<li>${fmtDate(h.date)} ـ ${esc(h.label||'عطلة')} <button data-hol="${i}">×</button></li>`).join('')
    || '<li class="hint">لا عطل مضافة.</li>';
}
function renderSections() {
  const box = document.getElementById('sectionsBox'); if (!box) return;
  S.sections ||= { logo:true, osi:true, vocab:true, media:true, evalTable:true, sign:true };
  box.innerHTML = Object.entries(SECTION_LABELS).map(([k, label]) =>
    '<label class="btn"><input type="checkbox" data-sec="' + k + '" ' +
    (S.sections[k] !== false ? 'checked' : '') + '> ' + label + '</label>').join('');
  box.onchange = e => {
    const c = e.target.closest('[data-sec]'); if (!c) return;
    S.sections[c.dataset.sec] = c.checked;
    DB.put('settings', S);
  };
}

const stVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v ?? ''; };

/* ────────── الطباعة ────────── */
function printCurrent(mode) {
  const s = sessionsIdx[grade][curIdx];
  const paper = document.getElementById('paper');
  const keep = paper.innerHTML;
  if (mode === 'worksheet') paper.innerHTML = worksheetHTML(s);
  window.print();
  if (mode === 'worksheet') setTimeout(() => { paper.innerHTML = keep; renderEditor(); }, 300);
}

/* ────────── الإقلاع ────────── */
function banner(html, kind) {
  const d = document.createElement('div');
  d.className = 'banner ' + (kind || '');
  d.innerHTML = html;
  document.body.insertBefore(d, document.body.firstChild.nextSibling);
}

(async function boot() {
  try { await start(); }
  catch (err) {
    console.error(err);
    banner(`<b>تعذّر تشغيل التطبيق.</b><br>${esc(err.message || err)}`, 'err');
  }
})();

async function start() {
  for (const gid of Object.keys(CURRICULA)) sessionsIdx[gid] = flatten(gid);

  const saved = await DB.get('settings', 'app');
  S = saved || { ...DEFAULTS, ts: 0 };
  S.timetable ||= DEFAULTS.timetable; S.holidays ||= [];
  // ترحيل: جدول الحصص المعتمد لهذا العام يستبدل أيّ جدول قديم محفوظ ويعيد توليد التواريخ
  const ttMigrate = (S.ttVersion || 0) < DEFAULTS.ttVersion;
  if (ttMigrate) {
    S.timetable = JSON.parse(JSON.stringify(DEFAULTS.timetable));
    S.start = DEFAULTS.start; S.ttVersion = DEFAULTS.ttVersion;
  }
  // الإعدادات الافتراضية والترحيل لا يُعدّان تعديلاً ـ حتى لا يطغيا على إعداداتك في جهاز آخر عند المزامنة
  if (!saved || ttMigrate) await DB.putRaw('settings', S);

  (await DB.all('preps')).forEach(p => prepCache[p.id] = p);
  await loadSessions();
  if (ttMigrate) { generateDates(); await persistSessions(true); }

  const gs = document.getElementById('gradeSel');
  gs.innerHTML = Object.keys(CURRICULA).map(g =>
    `<option value="${g}">${CURRICULA[g].name} ـ ${CURRICULA[g].section}</option>`).join('');
  gs.value = grade;

  // لو لم تولَّد التواريخ بعد، ولّدها تلقائياً من ١٥/٩/٢٠٢٦
  if (!sessionsIdx[grade].some(s => s.date)) { generateDates(); await persistSessions(true); }

  /* الأحداث */
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => show(t.dataset.view));
  gs.onchange = () => { grade = gs.value; curIdx = 0;
    const v = document.querySelector('.view:not(.hidden)').id.replace('view-','');
    show(v === 'editor' ? 'editor' : v); if (v === 'editor') renderEditor(); };

  document.body.addEventListener('click', e => {
    const row = e.target.closest('[data-g][data-i]');
    if (row) return openEditor(row.dataset.g, +row.dataset.i);
    const hb = e.target.closest('[data-hol]');
    if (hb) { S.holidays.splice(+hb.dataset.hol, 1); DB.put('settings', S); renderSettings(); }
  });

  document.getElementById('prevSes').onclick = () => { curIdx--; renderEditor(); };
  document.getElementById('nextSes').onclick = () => { curIdx++; renderEditor(); };
  document.getElementById('btnPrint').onclick = () => printCurrent('sheet');
  document.getElementById('btnWorksheet').onclick = () => printCurrent('worksheet');
  document.getElementById('bookList').addEventListener('change', async e => {
    const r = e.target.closest('[data-role]'); if (!r) return;
    const rec = await DB.get('books', r.dataset.role);
    if (rec) { rec.role = r.value; await DB.put('books', rec); }
  });
  document.getElementById('bookFile').onchange = e => { const b = e.target.files[0]; if (b) addBook(b); e.target.value = ''; };
  document.getElementById('btnCrop').onclick = () => openInsertViewer();
  document.body.addEventListener('click', e => {
    const o = e.target.closest('[data-openbook]');
    if (o) { wireViewer(); return openLessonViewer(null, o.dataset.openbook); }
    const rl = e.target.closest('[data-role]');
    if (rl) return;
    const d = e.target.closest('[data-delbook]');
    if (d) { if (confirm('حذف هذا الملف من المكتبة؟')) DB.del('books', d.dataset.delbook).then(renderLibrary); }
  });
  document.getElementById('imgFile').onchange = e => { const f = e.target.files[0]; if (f) insertImage(f); e.target.value = ''; };
  document.getElementById('fsSel').value = String(S.fontSize || 14);
  document.getElementById('fsSel').onchange = e => { S.fontSize = +e.target.value; DB.put('settings', S); renderEditor(); };
  document.getElementById('paper').addEventListener('click', e => {
    const b = e.target.closest('[data-delfig]'); if (!b) return;
    const ses = sessionsIdx[grade][curIdx];
    const p = prepCache[ses.id] || (prepCache[ses.id] = { id: ses.id });
    p.figs = (p.figs !== undefined ? p.figs : (ses.figs || [])).filter((_, i) => i !== +b.dataset.delfig);
    markDirty(ses); renderEditor();
  });
  document.getElementById('nbSearch').oninput = renderNotebook;
  document.getElementById('nbFilter').onchange = renderNotebook;

  ['stTeacher','stSchool','stYear','stTerm','stStart','stEnd'].forEach(id => {
    document.getElementById(id).onchange = e => {
      const key = id.replace('st','').toLowerCase();
      S[{teacher:'teacher',school:'school',year:'year',term:'term',start:'start',end:'end'}[key]] = e.target.value;
      DB.put('settings', S);
    };
  });

  document.getElementById('timetable').addEventListener('change', e => {
    const sel = e.target.closest('[data-tt]'); if (!sel) return;
    const gid = sel.dataset.tt, d = +sel.dataset.d;
    S.timetable[gid] = (S.timetable[gid] || []).filter(x => x.d !== d);
    if (sel.value) S.timetable[gid].push({ d, p: +sel.value });
    DB.put('settings', S);
  });

  document.getElementById('addHol').onclick = () => {
    const d = document.getElementById('holDate').value;
    if (!d) return;
    S.holidays.push({ date: d, label: document.getElementById('holLabel').value || 'عطلة' });
    document.getElementById('holLabel').value = '';
    DB.put('settings', S); renderSettings();
  };

  document.getElementById('btnGenerate').onclick = async () => {
    const rep = generateDates(); await persistSessions();
    document.getElementById('genMsg').textContent =
      Object.entries(rep).map(([g,n]) => `${CURRICULA[g].name}: وُزّعت ${ar(n)} حصة`).join(' · ');
    renderHome();
  };

  const exportAll = async withBooks => {
    const data = await DB.dump(withBooks);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    a.download = `دفتر_التحضير_${iso(new Date())}${withBooks ? '_مع_الكتب' : ''}.daftar`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  document.getElementById('btnExport').onclick = () => exportAll(false);
  document.getElementById('btnExportBooks').onclick = () => exportAll(true);
  document.getElementById('impFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!confirm('سيُستبدل ما في هذا الجهاز بمحتوى الملف. متابعة؟')) return;
      await DB.restore(data);
      location.reload();
    } catch { alert('الملف غير صالح. اختر ملف .daftar أو .json صادراً من التطبيق.'); }
  };

  window.addEventListener('resize', checkOverflow);
  if ('serviceWorker' in navigator && location.protocol !== 'file:')
    navigator.serviceWorker.register('sw.js').catch(()=>{});

  show('home');
  Sync.init();

  // تنبيه إن كان التطبيق يعمل بلا حفظ دائم (فُتح الملف مباشرة بدل تشغيل الخادم)
  if (DB.noStore) {
    banner(
      `<b>التطبيق يعمل الآن بلا حفظ دائم.</b> فتحتَ الملف مباشرة، والمتصفح يمنع التخزين في هذه الحالة.
       يمكنك التصفّح والكتابة والطباعة، لكنّ ما تكتبه يبقى في الذاكرة فقط.<br>
       للحفظ الدائم أغلق هذه الصفحة وشغّل <code>تشغيل التطبيق.cmd</code> داخل المجلد نفسه.
       <div class="banner-actions">
         <button class="btn primary" id="bSaveFile">حفظ عملي في ملف</button>
         <button class="btn" id="bSaveDraft">حفظ مسودة مؤقتة</button>
         <button class="btn" id="bNoSave">متابعة بلا حفظ</button>
       </div>`, 'warn');
    document.getElementById('bSaveFile').onclick  = () => saveToFile('نسخة');
    document.getElementById('bSaveDraft').onclick = () => saveToFile('مسودة');
    document.getElementById('bNoSave').onclick    = e => { unsaved = 0; e.target.closest('.banner').remove(); };
  }
}
