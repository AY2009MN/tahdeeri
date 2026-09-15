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
    out.push(`[[slot:${label}]]`);
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
      evalx: s.evalx, worksheet: s.worksheet || null, figs: s.figs || [],
      ready: !!u.ready                // حصة جاهزة ضمن المنهج (الوحدة الأولى) تُعدّ محضَّرة
    });
  })));
  return out;
}

/** محضَّرة: جاهزة في المنهج أو عدّلها المعلّم */
const isDone = s => s.ready || s.status === 'prepped';

/* ────────── الصفوف والشعب ──────────
   S.classes = [{ id, g: '8'|'9', name: '٨/١', tt: [{d,p}] }] ـ لكل شعبة جدولها وتواريخها ،
   والتحضير نفسه مشترك بين شعب الصف الواحد. الشعبة المختارة تظهر في رأس الورقة وتواريخها. */
const curClass = () => (S.classes || []).find(c => c.id === S.cls) || (S.classes || [])[0];
let classDates = {};                       // معرّف الشعبة ← [{date, period}] بترتيب الحصص

function computeDates() {
  const hol = new Set(S.holidays.map(h => h.date));
  const startAll = parseISO(S.start), endAll = parseISO(S.end);
  const report = {};
  for (const c of S.classes) {
    const slots = (c.tt || []).slice().sort((a, b) => a.d - b.d || a.p - b.p);
    const total = sessionsIdx[c.g].length;
    const out = classDates[c.id] = [];
    const d = new Date(startAll);
    while (slots.length && out.length < total && d <= endAll) {
      const wd = d.getDay();
      if (wd !== 5 && wd !== 6 && !hol.has(iso(d)))            // تخطّي الجمعة والسبت والعطل
        for (const sl of slots.filter(x => x.d === wd)) { if (out.length >= total) break; out.push({ date: iso(d), period: sl.p }); }
      d.setDate(d.getDate() + 1);
    }
    report[c.id] = out.length;
  }
  return report;
}

/** تطبيق تواريخ الشعبة المختارة على حصص صفّها */
function applyClass() {
  const c = curClass(); if (!c) return;
  grade = c.g;
  const ds = classDates[c.id] || [];
  sessionsIdx[c.g].forEach((x, i) => { x.date = ds[i] ? ds[i].date : null; x.period = ds[i] ? ds[i].period : null; });
}
const generateDates = () => { const r = computeDates(); applyClass(); return r; };

function fillClassSel() {
  const gs = document.getElementById('gradeSel');
  gs.innerHTML = S.classes.map(c => `<option value="${c.id}">${esc(CURRICULA[c.g].name)} ـ ${esc(c.name)}</option>`).join('');
  gs.value = curClass().id;
}

async function persistSessions() {
  for (const gid of Object.keys(sessionsIdx))
    for (const s of sessionsIdx[gid])
      await DB.put('sessions', { id: s.id, date: s.date || null, period: s.period || null, status: s.status || 'planned' });
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

/* ────────── بناء ورقة A4 ────────── */
const FIELDS = ['intro','show','close','evalx','vocab','mediaExtra'];

function prepOf(s) { return prepCache[s.id] || {}; }

const on = k => !S.sections || S.sections[k] !== false;

function sheetHTML(s) {
  const p = prepOf(s);
  const v = (k, fb) => (p[k] !== undefined && p[k] !== null && p[k] !== '') ? p[k] : (fb ?? '');
  /* المقدمة والخاتمة والتقويم: من سطر واحد إلى ٤ أسطر كحدّ أقصى (تُحفظ لكل حصة) */
  const lines = p.lines || {};
  const hSt = f => `class="lines" style="--ln:${lines[f] || 1}" data-lines="${lines[f] || 1}"`;
  const hCtl = f => `<span class="hctl no-print"><button data-hf="${f}" data-hd="-1" title="سطر أقل">−</button><span class="hv">${ar(lines[f] || 1)} س</span><button data-hf="${f}" data-hd="1" title="سطر أكثر">+</button></span>`;
  const media = s.media.slice(0, 3);
  while (media.length < 3) media.push('اختيار عنصر.');

  const headRows = [1,2,3].map(i => i === 1
    ? `<tr><td class="valb">${fmtDate(s.date)}</td><td class="valb">${esc((curClass() || s).name || s.section)}</td><td class="valb">${s.period?ar(s.period):'……'}</td></tr>`
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
      <div class="secttl">المقدمة والتمهيد${hCtl('intro')}</div>
      <div class="sectwrap lines" style="--ln:${lines['intro'] || 1}" data-lines="${lines['intro'] || 1}">
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
      <div class="secttl">الخاتمة والتقييم${hCtl('close')}</div>
      <div class="sectbox lines" contenteditable data-f="close" style="--ln:${lines['close'] || 1}" data-lines="${lines['close'] || 1}">${renderRich(v('close', s.close))}</div>
    </div>

    <div class="sect">
      <div class="secttl">التقويم${hCtl('evalx')}</div>
      <div class="sectwrap lines" style="--ln:${lines['evalx'] || 1}" data-lines="${lines['evalx'] || 1}">
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
      <div class="meta"><span>${esc(s.gradeName)} ـ ${esc((curClass() || s).name || s.section)}</span><span>${esc(s.code)} ${esc(s.title)}</span></div>
      <ol><li>${mathWrap(esc(w.q1))}</li><li>${mathWrap(esc(w.q2))}</li></ol>
      <div class="nameline">الاسم: ………………………………  التاريخ: ${fmtDate(s.date)}</div>
    </div>`;
  return `<div class="wsheet">${cell.repeat(4)}</div>`;
}

/* ────────── المحرّر ────────── */
function openEditor(gid, idx, clsId) {
  const cc = curClass();
  const c = clsId ? S.classes.find(x => x.id === clsId) : (cc && cc.g === gid ? cc : S.classes.find(x => x.g === gid));
  if (c) { S.cls = c.id; applyClass(); document.getElementById('gradeSel').value = c.id; }
  grade = gid; curIdx = idx;
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
  zoomPaper();
  hydrateAssets(paper).then(() => checkOverflow());
  checkOverflow();
}

function markDirty(s) {
  const st = document.getElementById('saveState');
  st.textContent = 'جارٍ الحفظ…'; st.classList.add('dirty');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
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

/* ────────── نسخة الطباعة المرقّمة ──────────
   على الشاشة تتمدّد الورقة بلا قصّ لتبقى قابلة للتحرير. للطباعة تُبنى نسخة A4 في #printArea:
   تُصبّ عناصر «العرض» ثم «تابع العرض» بالترتيب في صناديق ثابتة الارتفاع ، وتُضاف صفحات
   «تابع العرض» عند الحاجة قبل صفحة الخاتمة والتقويم ـ فلا يُقصّ مثال ولا تصغر الصور حتى تتعذّر قراءتها. */
let printPages = 0;

async function buildPrint() {
  const host = document.getElementById('printArea');
  const src = [...document.querySelectorAll('#paper .sheet')];
  host.innerHTML = '';
  document.body.classList.remove('pbuilt');
  if (src.length < 2) return 0;
  const [p1, p2] = src.slice(0, 2).map(s => {
    const c = s.cloneNode(true);
    c.classList.add('psheet');
    c.querySelectorAll('.inlbar,.inlh,.fighandle,.figbar,.fh,.figcolors').forEach(x => x.remove());
    c.querySelectorAll('[contenteditable]').forEach(x => x.removeAttribute('contenteditable'));
    c.querySelectorAll('.sel,.overflowwarn').forEach(x => x.classList.remove('sel', 'overflowwarn'));
    return c;
  });
  host.append(p1, p2);
  await Promise.all([...host.querySelectorAll('img')].map(im => im.decode ? im.decode().catch(() => {}) : 0));

  /* ورقة التحضير صفحتان دائماً:
     يُصبّ «العرض» ثم «تابع العرض» بالترتيب ، وتُصغَّر كل الصور بنسبة واحدة (أكبر نسبة ممكنة).
     إن كان المحتوى كثيراً يُوزَّع على عمودين في كل صفحة ، فتبقى الصور أكبر وأوضح. */
  const b1 = p1.querySelector('.sectbox[data-f="show"]'), b2 = p2.querySelector('.sectbox[data-f="show2"]');
  let best = { k: 1, cols: false, fs: S.fontSize || 14 }, fits = true;
  if (b1 && b2) {
    const nodes = [...b1.children, ...b2.children];
    const inls = nodes.flatMap(n => [...(n.matches('.inl') ? [n] : []), ...n.querySelectorAll('.inl')]);
    const introInls = [...p1.querySelectorAll('.sectbox[data-f="intro"] .inl')];   // صور المقدمة تُصغَّر معها
    const stream = [];
    for (let i = 0, unit = []; i < nodes.length; i++) {
      unit.push(nodes[i]);
      if (!(nodes[i].matches('.mini, .alert, .gap, .inllbl') && i < nodes.length - 1)) { stream.push(unit); unit = []; }
    }
    const wrapOver = box => { const w = box.closest('.sectwrap') || box; return w.scrollHeight > w.clientHeight + 1; };
    const containers = cols => [b1, b2].flatMap(box => {
      box.replaceChildren();
      box.classList.toggle('pcols', cols);
      if (!cols) return [box];
      const a = document.createElement('div'), b = document.createElement('div');
      a.className = b.className = 'pcol';
      box.append(a, b);
      return [a, b];
    });
    // k = عرض الصورة نسبةً إلى عرضها المختار على كامل الصفحة (في العمودين: نصف الصفحة حدٌّ أعلى)
    let lastList = [];
    const layout = (kk, cols) => {
      inls.forEach(sp => { sp.style.width = Math.min(100, (+sp.dataset.w || 90) * kk * (cols ? 2 : 1)).toFixed(1) + '%'; });
      introInls.forEach(sp => { sp.style.width = ((+sp.dataset.w || 90) * kk).toFixed(1) + '%'; });
      const list = lastList = containers(cols);
      const over = c => cols ? c.scrollHeight > c.clientHeight + 1 : wrapOver(c);
      let ci = 0;
      for (const u of stream) {
        u.forEach(n => list[ci].appendChild(n));
        while (over(list[ci])) {
          if (list[ci].children.length === u.length || ci === list.length - 1) return false;
          u.forEach(n => list[ci].removeChild(n));
          ci++;
          u.forEach(n => list[ci].appendChild(n));
        }
      }
      return !list.some(over);
    };
    const search = cols => {
      const hi = cols ? 0.5 : 1;
      if (layout(hi, cols)) return hi;
      let lo = 0.15;
      if (!layout(lo, cols)) return 0;
      let top = hi;
      for (let i = 0; i < 9; i++) { const mid = (lo + top) / 2; if (layout(mid, cols)) lo = mid; else top = mid; }
      return lo;
    };
    const tryFont = fs => {
      host.style.setProperty('--sheetfs', fs + 'px');
      const single = search(false);
      const two = single >= 0.55 ? 0 : search(true);
      return two > single + 0.03 ? { k: two, cols: true, fs } : { k: single, cols: false, fs };
    };
    const fs0 = S.fontSize || 14;
    best = tryFont(fs0);
    if (best.k < 0.45 && fs0 > 12) { const alt = tryFont(12); if (alt.k > best.k + 0.04) best = alt; }
    host.style.setProperty('--sheetfs', best.fs + 'px');
    fits = best.k > 0;
    layout(fits ? best.k : 0.15, best.cols);
    /* ملء الفراغ: كل عمود أو صفحة تُكبَّر صورها بنسبة واحدة ما دامت تتّسع ،
       دون تجاوز العرض الذي اختاره المعلّم للصورة (أو عرض العمود) */
    if (fits) for (const c of lastList) {
      const its = [...c.querySelectorAll(".inl")];
      if (!its.length) continue;
      const base = its.map(sp => parseFloat(sp.style.width));
      const cap = Math.min(...its.map((sp, i) => (best.cols ? 100 : (+sp.dataset.w || 90)) / base[i]));
      const overC = () => best.cols ? c.scrollHeight > c.clientHeight + 1 : wrapOver(c);
      const apply = f => its.forEach((sp, i) => { sp.style.width = (base[i] * f).toFixed(1) + "%"; });
      if (cap <= 1.01) continue;
      let lo = 1, hi = cap;
      apply(hi); if (!overC()) continue;
      for (let i = 0; i < 8; i++) { const mid = (lo + hi) / 2; apply(mid); if (overC()) hi = mid; else lo = mid; }
      apply(lo);
    }
  } else host.style.setProperty('--sheetfs', (S.fontSize || 14) + 'px');
  document.body.classList.add('pbuilt');
  printPages = 2;
  const info = document.getElementById('pagesInfo');
  if (info) {
    const pct = Math.round(best.k * 100);
    info.textContent = !fits ? 'تنبيه: المحتوى أكبر من صفحتين ـ احذف أو صغّر بعض الصور'
      : `الطباعة: صفحتان${best.cols ? ' بعمودين' : ''}${best.k < 1 ? ` · الصور ${ar(pct)}٪` : ''}`;
    info.classList.toggle('dirty', !fits || best.k < 0.35);
  }
  window.__printInfo = { k: best.k, cols: best.cols, fs: best.fs };
  return fits ? best.k : -1;
}
let printTimer = 0;
const schedulePrint = () => { clearTimeout(printTimer); printTimer = setTimeout(buildPrint, 700); };
window.fitSheets = () => checkOverflow();   // ترتيب الطباعة يُبنى عند الضغط على «معاينة وطباعة» فقط               // يُستدعى بعد إدراج صورة أو تغيير حجمها

/** على الشاشات الأضيق من A4 تُصغَّر الورقة كلها بصرياً وتبقى هندستها A4 كما تُطبع */
function zoomPaper() {
  const paper = document.getElementById('paper'); if (!paper) return;
  const avail = (paper.parentElement || document.body).clientWidth - 20;
  paper.style.zoom = Math.min(1, avail / 800).toFixed(3);
}
window.addEventListener('resize', zoomPaper);

/** ضبط المحتوى على الصفحتين : تُصغَّر صور كل صندوق ممتلئ بأقلّ قدر يكفي لاتّساعه.
    يعمل عند الطلب فقط ـ لا بعد كل حرف ـ فلا يتجمّد التطبيق. */
function fitToPages() {
  let fixed = 0, stuck = 0;
  document.querySelectorAll('#paper .sectwrap').forEach(w => {
    const inls = [...w.querySelectorAll('.inl')];
    const over = () => w.scrollHeight > w.clientHeight + 2;
    if (!over()) return;
    if (!inls.length) { stuck++; return; }
    const base = inls.map(sp => parseFloat(sp.style.width) || +sp.dataset.w || 90);
    const apply = f => inls.forEach((sp, i) =>
      sp.style.width = Math.max(18, base[i] * f).toFixed(1) + '%');
    let lo = 0.25, hi = 1;
    apply(lo);
    if (over()) { apply(lo); stuck++; }                 // حتى أصغر حجم لا يكفي
    else {
      for (let i = 0; i < 10; i++) { const mid = (lo + hi) / 2; apply(mid); if (over()) hi = mid; else lo = mid; }
      apply(lo); fixed++;
    }
    const box = w.querySelector('[contenteditable][data-f]');
    if (box) box.dispatchEvent(new Event('input', { bubbles: true }));   // لحفظ العروض الجديدة
  });
  checkOverflow();
  const info = document.getElementById('pagesInfo');
  if (info && !stuck && fixed) info.textContent = `ضُبطت ${ar(fixed)} صناديق ـ الطباعة مطابقة للمعاينة`;
  if (stuck) alert('بعض الصناديق ما زالت ممتلئة حتى بعد التصغير. احذف عنصراً أو انقله إلى الصفحة الثانية.');
}

/** تنبيه بصري عند تجاوز المحتوى ارتفاع الصندوق ، مع بيان حالة الطباعة */
function checkOverflow() {
  let over = 0;
  document.querySelectorAll('.sectwrap, .sectbox:not(.nb)').forEach(b => {
    const bad = b.scrollHeight > b.clientHeight + 4;
    if (bad) over++;
    b.classList.toggle('overflowwarn', bad);
  });
  const info = document.getElementById('pagesInfo');
  if (info) {
    info.textContent = over
      ? `تنبيه: ${ar(over)} صندوقاً ممتلئاً ـ صغّر صورة أو انقلها إلى الصفحة الثانية`
      : 'الطباعة مطابقة للمعاينة ـ صفحتان';
    info.classList.toggle('dirty', over > 0);
  }
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

  const items = [];
  for (const c of S.classes) (classDates[c.id] || []).forEach((d, i) => {
    if (d.date) items.push({ c, s: sessionsIdx[c.g][i], date: d.date, period: d.period });
  });
  const attrs = x => `data-g="${x.s.gradeId}" data-i="${x.s.n}" data-c="${x.c.id}"`;
  const todays = items.filter(x => x.date === t).sort((a, b) => a.period - b.period);
  document.getElementById('todaySessions').innerHTML = todays.length
    ? todays.map(x => `<div class="card ${isDone(x.s)?'done':''}" ${attrs(x)}>
         <b>${esc(x.s.gradeName)} ${esc(x.c.name)} ـ الحصة ${ar(x.period||0)}</b>
         <small>${esc(x.s.code)} ${esc(x.s.title)}</small>
         <small>${esc(x.s.focus)}</small></div>`).join('')
    : '<p class="hint">لا توجد حصص اليوم.</p>';

  const start = new Date(today); start.setDate(start.getDate() - today.getDay());
  const week = [];
  for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(d.getDate()+i); week.push(iso(d)); }
  const rows = items.filter(x => week.includes(x.date))
                    .sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);
  document.getElementById('weekList').innerHTML = rows.length
    ? rows.map(x => `<div class="wrow" ${attrs(x)}>
        <span class="d">${fmtDate(x.date).split(' ')[0]} ${ar(parseISO(x.date).getDate())}</span>
        <span class="t">${esc(x.s.gradeName)} ${esc(x.c.name)} · الحصة ${ar(x.period)} · ${esc(x.s.code)} ${esc(x.s.title)}</span>
        <span class="s">${isDone(x.s)?'محضَّرة':'—'}</span></div>`).join('')
    : '<p class="hint">لا حصص هذا الأسبوع.</p>';
  refreshStats();
}

function refreshStats() {
  const list = sessionsIdx[grade] || [];
  document.getElementById('statTotal').textContent = ar(list.length);
  document.getElementById('statDone').textContent = ar(list.filter(s => isDone(s)).length);
}

function renderNotebook() {
  const q = (document.getElementById('nbSearch').value || '').trim();
  const f = document.getElementById('nbFilter').value;
  const list = sessionsIdx[grade];
  const byUnit = {};
  list.forEach(s => {
    if (q && !(s.title + s.code + s.focus).includes(q)) return;
    if (f === 'done' && !isDone(s)) return;
    if (f === 'todo' && isDone(s)) return;
    (byUnit[s.unitNo] ||= { title: s.unitTitle, rows: [] }).rows.push(s);
  });
  document.getElementById('nbList').innerHTML = Object.entries(byUnit).map(([no, u]) => `
    <div class="nbunit"><h4>الوحدة ${esc(no)} ـ ${esc(u.title)}</h4>
      ${u.rows.map(s => `<div class="nbrow ${isDone(s)?'done':''}" data-g="${s.gradeId}" data-i="${s.n}">
        <span class="n">${ar(s.n+1)}</span>
        <span class="t">${esc(s.code)} ${esc(s.title)} <small style="color:#5a6472">(${ar(s.partIdx)}/${ar(s.partOf)})</small></span>
        <span class="dt">${fmtDate(s.date)}</span></div>`).join('')}
    </div>`).join('') || '<p class="hint">لا نتائج.</p>';
}

function renderSettings() {
  stVal('stTeacher', S.teacher); stVal('stSchool', S.school);
  stVal('stYear', S.year); stVal('stTerm', S.term);
  stVal('stStart', S.start); stVal('stEnd', S.end);

  document.getElementById('timetable').innerHTML = S.classes.map(c => `
    <div class="nbunit"><h4 class="clshead">${esc(CURRICULA[c.g].name)} ـ الشعبة
        <input data-cname="${c.id}" value="${esc(c.name)}" style="width:92px">
        ${S.classes.length > 1 ? `<button class="btn sm" data-cdel="${c.id}">حذف الشعبة</button>` : ''}</h4>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden">
        <tr>${DAYS.slice(0,5).map(d => `<th style="padding:6px;font-size:13px;background:#f2f5f9">${d}</th>`).join('')}</tr>
        <tr>${[0,1,2,3,4].map(d => {
          const slot = (c.tt || []).find(x => x.d === d);
          return `<td style="padding:6px;text-align:center">
            <select data-tt="${c.id}" data-d="${d}">
              <option value="">—</option>
              ${[1,2,3,4,5,6,7].map(p => `<option value="${p}" ${slot&&slot.p===p?'selected':''}>الحصة ${ar(p)}</option>`).join('')}
            </select></td>`;
        }).join('')}</tr>
      </table>
    </div>`).join('') + `
    <div class="toolbar">
      <select id="newClsGrade">${Object.keys(CURRICULA).map(g => `<option value="${g}">${esc(CURRICULA[g].name)}</option>`).join('')}</select>
      <input id="newClsName" placeholder="اسم الشعبة ـ مثل ٨/٢" style="width:170px">
      <button class="btn primary" id="addCls">＋ إضافة شعبة</button>
    </div>`;

  renderSections();
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
async function printCurrent(mode) {
  const s = sessionsIdx[grade][curIdx];
  const paper = document.getElementById('paper');
  if (mode === 'worksheet') {
    document.body.classList.remove('pbuilt');
    document.getElementById('printArea').innerHTML = '';
    paper.innerHTML = worksheetHTML(s);
    window.print();
    setTimeout(() => renderEditor(), 300);
    return;
  }
  // نطبع ورقة الشاشة نفسها ـ لا نسخة معاد توزيعها ـ حتى تطابق الطباعة ما تراه تماماً
  clearTimeout(printTimer);
  document.body.classList.remove('pbuilt');
  document.getElementById('printArea').innerHTML = '';
  paper.style.zoom = 1;
  figSel = null;
  renderEditor();
  await new Promise(r => setTimeout(r, 250));
  await Promise.all([...paper.querySelectorAll('img')]
    .map(im => im.decode ? im.decode().catch(() => {}) : 0));
  window.print();
  setTimeout(zoomPaper, 400);
}

/* ────────── الإقلاع ────────── */
function banner(html, kind) {
  const d = document.createElement('div');
  d.className = 'banner no-print ' + (kind || '');
  d.innerHTML = html;
  document.body.insertBefore(d, document.body.firstChild.nextSibling);
}

(async function boot() {
  try { await start(); }
  catch (err) {
    console.error(err);
    // إصلاح ذاتي: خطأ عند الإقلاع غالباً سببه نسخة قديمة مخزّنة ـ نمسحها ونعيد التحميل مرّة واحدة
    let healed = false; try { healed = sessionStorage.getItem("daftar_healed") === "1"; sessionStorage.setItem("daftar_healed", "1"); } catch {}
    if (!healed && "serviceWorker" in navigator) {
      try {
        for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        for (const k of await caches.keys()) await caches.delete(k);
      } catch {}
      location.reload();
      return;
    }
    banner(`<b>تعذّر تشغيل التطبيق.</b><br>${esc(err.message || err)}`, 'err');
  }
})();

async function start() {
  for (const gid of Object.keys(CURRICULA)) sessionsIdx[gid] = flatten(gid);

  S = (await DB.get('settings', 'app')) || { ...DEFAULTS };
  S.timetable ||= DEFAULTS.timetable; S.holidays ||= [];
  // ترحيل: جدول الحصص المعتمد لهذا العام يستبدل أيّ جدول قديم محفوظ ويعيد توليد التواريخ
  const ttMigrate = (S.ttVersion || 0) < DEFAULTS.ttVersion;
  if (ttMigrate) {
    S.timetable = JSON.parse(JSON.stringify(DEFAULTS.timetable));
    S.start = DEFAULTS.start; S.ttVersion = DEFAULTS.ttVersion;
  }
  await DB.put('settings', S);

  (await DB.all('preps')).forEach(p => prepCache[p.id] = p);
  await loadSessions();
  // ترحيل: الجدول القديم (صف واحد لكل مستوى) يصبح شعبة لكل صف
  if (!Array.isArray(S.classes) || !S.classes.length) {
    S.classes = Object.keys(CURRICULA).map(g => ({ id: 'c' + g + '_1', g, name: CURRICULA[g].section,
      tt: JSON.parse(JSON.stringify((S.timetable || DEFAULTS.timetable)[g] || [])) }));
    S.cls = (S.classes.find(c => c.g === grade) || S.classes[0]).id;
    await DB.put('settings', S);
  }
  computeDates(); applyClass();

  const gs = document.getElementById('gradeSel');
  fillClassSel();

  /* الأحداث */
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => show(t.dataset.view));
  gs.onchange = () => {
    const prev = grade;
    S.cls = gs.value; applyClass();
    if (grade !== prev) curIdx = 0;
    DB.put('settings', S);
    show(document.querySelector('.view:not(.hidden)').id.replace('view-', ''));
  };

  document.body.addEventListener('click', e => {
    const row = e.target.closest('[data-g][data-i]');
    if (row) return openEditor(row.dataset.g, +row.dataset.i, row.dataset.c);
    const hb = e.target.closest('[data-hol]');
    if (hb) { S.holidays.splice(+hb.dataset.hol, 1); DB.put('settings', S); renderSettings(); }
  });

  document.getElementById('prevSes').onclick = () => { curIdx--; renderEditor(); };
  document.getElementById('nextSes').onclick = () => { curIdx++; renderEditor(); };
  document.getElementById('btnFit').onclick = () => fitToPages();
  document.getElementById('btnPrint').onclick = () => printCurrent('sheet');
  document.getElementById('btnBlank').onclick = () => printBlank();
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
  /* ضبط ارتفاع صناديق المقدمة والخاتمة والتقويم يدوياً (يُحفظ لكل حصة ويُطبَّق في الطباعة) */
  document.getElementById('paper').addEventListener('click', e => {
    const hb = e.target.closest('[data-hd]'); if (!hb) return;
    e.preventDefault(); e.stopPropagation();
    const ses = sessionsIdx[grade][curIdx];
    const p = prepCache[ses.id] || (prepCache[ses.id] = { id: ses.id });
    const f = hb.dataset.hf, d = +hb.dataset.hd;
    p.lines = { ...(p.lines || {}) };
    p.lines[f] = Math.max(1, Math.min(4, (p.lines[f] || 1) + d));
    markDirty(ses); renderEditor();
  });
  document.getElementById('paper').addEventListener('click', e => {
    const b = e.target.closest('[data-delfig]'); if (!b) return;
    const ses = sessionsIdx[grade][curIdx];
    const p = prepCache[ses.id] || (prepCache[ses.id] = { id: ses.id });
    p.figs = (p.figs !== undefined ? p.figs : (ses.figs || [])).filter((_, i) => i !== +b.dataset.delfig);
    markDirty(ses); renderEditor();
  });
  /* شريط تنسيق النص */
  const fmt = document.getElementById('fmtBar');
  fmt.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  fmt.addEventListener('click', e => {
    const b = e.target.closest('[data-cmd]'); if (!b) return;
    const box = document.activeElement && document.activeElement.closest('#paper [contenteditable][data-f]');
    if (!box) return alert('انقر أولاً داخل المقدمة أو العرض أو الخاتمة أو التقويم.');
    const [cmd, val] = b.dataset.cmd.split(':');
    if (cmd === 'hilite') document.execCommand('hiliteColor', false, val);
    else if (cmd === 'bullet') document.execCommand('insertText', false, '• ');
    else document.execCommand(cmd, false, val || null);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.getElementById('paper').addEventListener('focusout', e => {
    if (e.target.closest && e.target.closest('[contenteditable][data-f]')) checkOverflow();
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
    const sel = e.target.closest('[data-tt]'), nm = e.target.closest('[data-cname]');
    if (sel) {
      const c = S.classes.find(x => x.id === sel.dataset.tt), d = +sel.dataset.d;
      c.tt = (c.tt || []).filter(x => x.d !== d);
      if (sel.value) c.tt.push({ d, p: +sel.value });
    } else if (nm) {
      const c = S.classes.find(x => x.id === nm.dataset.cname);
      c.name = nm.value.trim() || c.name; fillClassSel();
    } else return;
    computeDates(); applyClass(); DB.put('settings', S);
  });
  document.getElementById('timetable').addEventListener('click', e => {
    const del = e.target.closest('[data-cdel]');
    if (del) {
      if (S.classes.length < 2 || !confirm('حذف هذه الشعبة وجدولها؟ (التحضير نفسه لا يُحذف)')) return;
      S.classes = S.classes.filter(c => c.id !== del.dataset.cdel);
      if (!S.classes.some(c => c.id === S.cls)) S.cls = S.classes[0].id;
    } else if (e.target.id === 'addCls') {
      const g = document.getElementById('newClsGrade').value, name = document.getElementById('newClsName').value.trim();
      if (!name) return alert('اكتب اسم الشعبة، مثل ٨/٢');
      S.classes.push({ id: 'c' + g + '_' + Date.now().toString(36), g, name, tt: [] });
    } else return;
    computeDates(); applyClass(); fillClassSel(); DB.put('settings', S); renderSettings();
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
      S.classes.map(c => `${CURRICULA[c.g].name} ${c.name}: وُزّعت ${ar(rep[c.id] || 0)} حصة`).join(' · ');
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

/* ────────── نموذج تحضير فارغ للكتابة اليدوية ──────────
   نفس القالب الرسمي بلا تاريخ ولا صف ولا رقم حصة ولا محتوى ،
   مع أسطر مسطَّرة في كل قسم ليكتب عليها المعلّم بخطّ يده.
   يُطبع بحدود سوداء صريحة حتى يخرج واضحاً بالحبر. */
function blankRows(n) {
  return Array.from({ length: n }, () => '<div class="rline"></div>').join('');
}

function blankSheetHTML() {
  const evalRows = [1, 2, 3].map(() =>
    '<tr>' + '<td>&nbsp;</td>'.repeat(5) + '</tr>').join('');
  return `
  <div class="sheet blank" data-page="1">
    <div class="hdrwrap">
      <table>
        <tr><td class="lbl">اليوم والتاريخ</td><td class="lbl">الصف</td><td class="lbl">الحصة</td></tr>
        <tr style="height:9mm"><td></td><td></td><td></td></tr>
      </table>
      ${on('logo') ? '<div class="logobox"><img src="icons/logo.png" alt="" onerror="this.style.display=&quot;none&quot;"></div>' : ''}
    </div>

    <table style="margin-top:2mm">
      <tr>
        <td class="lbl" style="width:13%">الوحدة</td><td class="lbl" style="width:30%">المجال</td>
        <td class="lbl" style="width:16%">البند</td><td class="lbl" style="width:41%">عنوان الدرس</td>
      </tr>
      <tr style="height:9mm"><td></td><td></td><td></td><td></td></tr>
    </table>

    <table style="margin-top:1mm">
      <tr><td class="lbl" style="width:34%">نواتج التعلم</td>
          <td class="lbl" style="width:33%">المعيار</td>
          <td class="lbl" style="width:33%">مؤشرات الأداء</td></tr>
      <tr><td class="rcell">${blankRows(3)}</td><td class="rcell">${blankRows(3)}</td><td class="rcell">${blankRows(3)}</td></tr>
    </table>

    <table style="margin-top:1mm">
      <tr><td class="lbl" style="width:22%">العبارات والمفردات :</td>
          <td class="rcell">${blankRows(2)}</td></tr>
    </table>

    <table style="margin-top:1mm">
      <tr>
        <td class="lbl" style="width:22%">الوسائل التعليمية</td>
        <td class="lbl" style="width:13%">الكتاب</td>
        <td style="height:8mm"></td><td></td><td></td>
      </tr>
    </table>

    <div class="sect" style="margin-top:3mm">
      <div class="secttl">المقدمة والتمهيد</div>
      <div class="sectwrap ruled" style="min-height:26mm"></div>
    </div>

    <div class="sect grow">
      <div class="secttl">العرض</div>
      <div class="sectwrap ruled grow"></div>
    </div>
  </div>

  <div class="sheet blank" data-page="2">
    <div class="sect grow">
      <div class="secttl">تابع العرض</div>
      <div class="sectwrap ruled grow"></div>
    </div>

    <div class="sect">
      <div class="secttl">الخاتمة والتقييم</div>
      <div class="sectwrap ruled" style="min-height:18mm"></div>
    </div>

    <div class="sect">
      <div class="secttl">التقويم</div>
      <div class="sectwrap ruled" style="min-height:26mm"></div>
    </div>

    <table style="margin-top:2mm">
      <tr>
        <td class="lbl" style="width:10%">الصف</td>
        <td class="lbl" style="width:24%">مدى تحقق نواتج التعلم</td>
        <td class="lbl" style="width:26%">ملائمة التحضير مع زمن الحصة</td>
        <td class="lbl" style="width:26%">فعالية الوسائل التعليمية المستخدمة</td>
        <td class="lbl" style="width:14%">التطبيق</td>
      </tr>
      ${evalRows}
    </table>

    <div class="sign">معلّم المادة: ……………………</div>
  </div>`;
}

/** يطبع نسخاً فارغة من القالب ـ العدد يختاره المعلّم */
async function printBlank() {
  const ans = prompt('كم نسخة فارغة تريد طباعتها؟ (كل نسخة صفحتان)', '1');
  if (ans === null) return;
  const n = Math.max(1, Math.min(20, parseInt(ans, 10) || 1));
  clearTimeout(printTimer);
  document.body.classList.remove('pbuilt');
  document.getElementById('printArea').innerHTML = '';
  const paper = document.getElementById('paper');
  paper.style.zoom = 1;
  figSel = null;
  paper.innerHTML = blankSheetHTML().repeat(n);
  await new Promise(r => setTimeout(r, 200));
  window.print();
  setTimeout(() => { renderEditor(); zoomPaper(); }, 400);
}
