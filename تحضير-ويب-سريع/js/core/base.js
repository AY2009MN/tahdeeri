/* ===== قاعدة بيانات محلية (IndexedDB) — تعمل بلا إنترنت وتبقى بعد إغلاق التطبيق =====
   المخازن:
     settings  : سجل واحد (id='app') فيه بيانات الورقة والجدول والعطل وتصحيحات صفحات الدروس
     sessions  : حصة لكل صف (id = "<grade>|<idx>") فيها التاريخ والحصة والحالة
     preps     : محتوى التحضير المحرَّر (id = نفس مفتاح الحصة)
     books     : ملفات PDF (كتاب الطالب ودليل المعلّم …)
     assets    : اللقطات المدرجة داخل التحضير (id ، data URL)
     overrides : تعديلات خطة الدروس فوق المنهج الأصلي
*/
const DB = (() => {
  const NAME = 'daftar_tahdeer', VER = 3;
  const STORES = ['settings', 'sessions', 'preps', 'books', 'assets', 'overrides'];
  let _db = null;

  /* مخزن احتياطي في الذاكرة:
     عند فتح الملف مباشرة بعنوان file:// يمنع المتصفح قاعدة البيانات،
     فيعمل التطبيق للعرض والطباعة فقط من دون حفظ ـ مع تنبيه ظاهر للمستخدم. */
  const mem = Object.fromEntries(STORES.map(s => [s, new Map()]));
  let memMode = false;
  const useMemory = () => { if (!memMode) { memMode = true; document.body?.classList.add('nostore'); } };

  function open() {
    if (memMode) return Promise.reject(new Error('memory'));
    if (_db) return Promise.resolve(_db);
    if (!self.indexedDB || location.protocol === 'file:') { useMemory(); return Promise.reject(new Error('memory')); }
    return new Promise((res, rej) => {
      const r = indexedDB.open(NAME, VER);
      r.onupgradeneeded = e => {
        const db = e.target.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      };
      r.onsuccess = e => { _db = e.target.result; res(_db); };
      r.onerror = () => rej(r.error);
    });
  }

  function tx(store, mode, fn, memFn) {
    return open().then(db => new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      const req = fn(s);
      if (req) req.onsuccess = () => { out = req.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
    })).catch(() => { useMemory(); return memFn(mem[store]); });
  }

  const blobToData = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
  const dataToBlob = async d => (await fetch(d)).blob();

  return {
    /** هل يعمل التطبيق بلا حفظ دائم؟ (فتح بعنوان file:// أو منع تخزين المواقع) */
    get noStore() { return memMode; },

    get:  (store, id)   => tx(store, 'readonly',  s => s.get(id),      m => m.get(id)),
    all:  (store)       => tx(store, 'readonly',  s => s.getAll(),     m => [...m.values()]),
    put:  (store, val)  => tx(store, 'readwrite', s => s.put(val),     m => (m.set(val.id, val), val)),
    del:  (store, id)   => tx(store, 'readwrite', s => s.delete(id),   m => m.delete(id)),
    clear:(store)       => tx(store, 'readwrite', s => s.clear(),      m => m.clear()),

    /** تصدير كل شيء إلى كائن واحد (ملف النقل). withBooks يضيف ملفات PDF. */
    async dump(withBooks) {
      const out = {
        app: 'daftar-tahdeer', version: VER, exportedAt: new Date().toISOString(),
        settings: await this.all('settings'), sessions: await this.all('sessions'),
        preps: await this.all('preps'), assets: await this.all('assets'), overrides: await this.all('overrides')
      };
      if (withBooks) {
        out.books = [];
        for (const b of await this.all('books')) out.books.push({ ...b, blob: await blobToData(b.blob) });
      }
      return out;
    },

    /** استيراد ملف نقل (يستبدل المحتوى الحالي لكل مخزن موجود في الملف) */
    async restore(data) {
      for (const st of ['settings', 'sessions', 'preps', 'assets', 'overrides']) {
        if (!data[st]) continue;
        await this.clear(st);
        for (const row of data[st]) await this.put(st, row);
      }
      if (data.books) {
        await this.clear('books');
        for (const b of data.books) await this.put('books', { ...b, blob: await dataToBlob(b.blob) });
      }
    }
  };
})();

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
