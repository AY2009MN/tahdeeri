/* يبحث عن عناوين تسمّي عنصراً من الكتاب («مثال (٢) ص(٤٠)») ولا يليها صورة ،
   ويُلحق بكلّ واحدٍ صورته.

       node build/fill-refs.cjs --scan     يعدّها ويكتب ما ينقص من قصاصات
       node build/fill-refs.cjs --apply    يُلحق [[img:…]] بعد كلّ عنوان

   المطابقة بأولويّة : لقطة صفحة العنوان ، ثمّ لقطة من نوعه ورقمه ، ثمّ نوعه.
   ما لا مرشّح له يُكتب في need.json ليُقصّ من الكتاب ثمّ يُعاد التشغيل.      */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'need.json');

global.window = {};
for (const f of ['curriculum8', 'curriculum9', 'gallery'])
  eval(fs.readFileSync(path.join(ROOT, 'js/data', f + '.js'), 'utf8'));
const C = { 8: window.CURRICULUM_8, 9: window.CURRICULUM_9 };

const AR = '٠١٢٣٤٥٦٧٨٩';
const num = s => { let n = ''; for (const c of s) { const i = AR.indexOf(c); if (i >= 0) n += i; else if (/[0-9]/.test(c)) n += c; } return n ? +n : null; };
const FIELDS = ['intro', 'show', 'show2', 'close', 'evalx'];
const NAMES = /مثال|دورك الآن|تمارين ذاتية|تمرين ذاتي|عبّر عن فهمك|اِستكشِف|استكشف|حلّ وناقش|قاعدة|تعريف|ملاحظة|نشاط/;

const kindOf = l => /مثال/.test(l) ? 'ex' : /دورك/.test(l) ? 'dawrak' : /فهمك/.test(l) ? 'fahmak'
  : /ستكشِ?ف/.test(l) ? 'istakshif' : /قاعدة/.test(l) ? 'qaeda' : /تعريف/.test(l) ? 'tarif'
  : /ملاحظة/.test(l) ? 'mulahaza' : null;

/** (وحدة ، درس) لاسم الملفّ من رمز الدرس */
function parts(code) {
  let m = code.match(/^([٠-٩]) ـ ([٠-٩])$/);
  if (m) return { u: num(m[1]), l: String(num(m[2])) };
  m = code.match(/^تقويم ([٠-٩])$/);
  if (m) return { u: num(m[1]), l: 't' };
  return code === 'مراجعة' ? { u: 'rev', l: null } : null;
}
const fileFor = (g, code, page) => {
  const p = parts(code); if (!p) return null;
  return p.l === null ? `g${g}-rev_p${page}.png` : `g${g}-${p.u}-${p.l}_p${page}.png`;
};

/** الصور المستعملة فعلاً في نصّ درس ـ لا نكرّر صورة موضوعة */
const usedIn = (g, l) => {
  const set = new Set();
  l.sessions.forEach(s => FIELDS.forEach(f => {
    for (const m of String(s[f] || '').matchAll(/\[\[img:img\/([^|\]]+)/g)) set.add(m[1]);
  }));
  return set;
};

/** يمرّ على كلّ عنوان بلا صورة ويعيد وصفه ومرشّحه */
function scan() {
  const out = [];
  for (const g of ['8', '9']) C[g].units.forEach(u => u.lessons.forEach(l => {
    const gal = (window.BOOK_GALLERY[g] || {})[l.code] || [];
    const used = usedIn(g, l);
    l.sessions.forEach((s, si) => FIELDS.forEach(f => {
      const lines = String(s[f] || '').split('\n');
      lines.forEach((ln, i) => {
        if (!/^##/.test(ln) || !NAMES.test(ln)) return;
        if (/\[\[img:/.test(lines.slice(i + 1, i + 3).join('\n'))) return;
        const page = num((ln.match(/ص\s*\(?\s*([٠-٩0-9]+)/) || [])[1] || '');
        const kind = kindOf(ln), n = num((ln.match(/\(\s*([٠-٩0-9]+)/) || [])[1] || '');
        const free = gal.filter(x => !used.has(x.f));
        const hit = (page && free.find(x => new RegExp(`_p${page}[a-z]?\\.png$`).test(x.f)))
          || (kind && n && free.find(x => new RegExp(`_${kind}${n}[a-z]?\\.png$`).test(x.f)))
          || (kind && free.find(x => new RegExp(`_${kind}[0-9]*[a-z]?\\.png$`).test(x.f)));
        out.push({ g, code: l.code, ses: si, field: f, at: i, line: ln, page,
                   pick: hit ? hit.f : null, want: page ? fileFor(g, l.code, page) : null });
        if (hit) used.add(hit.f);
      });
    }));
  }));
  return out;
}

/** يكتب ملفّ منهج بعد تعديل كائنه ـ الملفّ JSON مغلَّف ، فيُعاد بناؤه كاملاً */
function writeCurriculum(g, obj) {
  const p = path.join(ROOT, 'js/data/curriculum' + g + '.js');
  const src = fs.readFileSync(p, 'utf8');
  const marker = `window.CURRICULUM_${g} = `;
  const head = src.slice(0, src.indexOf(marker) + marker.length);
  const tail = src.slice(src.lastIndexOf('}') + 1);
  fs.writeFileSync(p, head + JSON.stringify(obj, null, 2) + tail, 'utf8');
}

/** عرض الصورة : صور الصفحة الكاملة أعرض من القصاصات المفردة */
const widthFor = f => /_p\d+[a-z]?\.png$/.test(f) ? 92 : 89;

/** يُلحق [[img:…]] بعد كلّ عنوان بلا صورة. يعيد عدد ما أُلحق. */
function apply() {
  const rows = scan();
  let done = 0, skip = 0;
  // نعالج من آخر سطر إلى أوّله في كل حقل ، فلا تنزاح المواضع
  const byField = new Map();
  for (const r of rows) {
    const key = `${r.g}|${r.code}|${r.ses}|${r.field}`;
    (byField.get(key) || byField.set(key, []).get(key)).push(r);
  }
  for (const [, list] of byField) {
    list.sort((a, b) => b.at - a.at);
    for (const r of list) {
      const pick = r.pick || (r.want && fs.existsSync(path.join(ROOT, 'img', r.want)) ? r.want : null);
      if (!pick) { skip++; continue; }
      const lesson = C[r.g].units.flatMap(u => u.lessons).find(l => l.code === r.code);
      const s = lesson.sessions[r.ses];
      const lines = String(s[r.field]).split('\n');
      lines.splice(r.at + 1, 0, `[[img:img/${pick}|${widthFor(pick)}]]`);
      s[r.field] = lines.join('\n');
      done++;
    }
  }
  for (const g of ['8', '9']) writeCurriculum(g, C[g]);
  return { done, skip };
}

module.exports = { scan, apply, fileFor, parts, num };

if (require.main === module) {
  if (process.argv.includes('--apply')) {
    const { done, skip } = apply();
    console.log(`أُلحقت ${done} صورة بعناوينها` + (skip ? ` · تعذّر ${skip}` : ' · لم يبقَ شيء ✓'));
  } else {
    const rows = scan();
    const seen = new Map();
    for (const r of rows) if (!r.pick && r.want && !seen.has(r.want))
      seen.set(r.want, { g: r.g, code: r.code, page: r.page, name: r.want });
    fs.writeFileSync(OUT, JSON.stringify([...seen.values()], null, 1));
    console.log(`عناوين بلا صورة : ${rows.length}`);
    console.log(`  لها مرشّح جاهز : ${rows.filter(r => r.pick).length}`);
    console.log(`  تحتاج قصّاً    : ${seen.size} صفحة  →  build/need.json`);
  }
}
