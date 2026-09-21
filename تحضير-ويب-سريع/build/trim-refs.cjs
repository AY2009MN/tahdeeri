/* ينزع صور الصفحات الكاملة من تحت عناوين «التمارين الذاتية».

   القاعدة من المعلّم : التمرين الذاتي يُذكَر بعنوانه وفرعه وصفحته فقط ، ولا
   تُوضع صورة صفحته كاملةً ـ فهي تملأ الورقة بما لا يخدم الشرح. أمّا الأنشطة
   والأمثلة ودورك الآن وحُلّ وناقش واستكشف فتحتاج صورها.

   ما كان قصاصةً دقيقة (لا صفحةً كاملة) يبقى ، فهو «الجزء الذي نحتاجه».

       node build/trim-refs.cjs            يعرض ما سيُنزع
       node build/trim-refs.cjs --apply    ينزعه                             */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

global.window = {};
for (const g of ['8', '9']) eval(fs.readFileSync(path.join(ROOT, 'js/data/curriculum' + g + '.js'), 'utf8'));
const C = { 8: window.CURRICULUM_8, 9: window.CURRICULUM_9 };
const FIELDS = ['intro', 'show', 'show2', 'close', 'evalx'];

const isSelfExercise = l => /تمارين ذاتية|تمرين ذاتي/.test(l);
const isFullPage = f => /_p\d+[a-z]?\.png$/.test(f);

function writeCurriculum(g, obj) {
  const p = path.join(ROOT, 'js/data/curriculum' + g + '.js');
  const src = fs.readFileSync(p, 'utf8');
  const marker = `window.CURRICULUM_${g} = `;
  const head = src.slice(0, src.indexOf(marker) + marker.length);
  const tail = src.slice(src.lastIndexOf('}') + 1);
  fs.writeFileSync(p, head + JSON.stringify(obj, null, 2) + tail, 'utf8');
}

function run(apply) {
  const hits = [];
  for (const g of ['8', '9']) C[g].units.forEach(u => u.lessons.forEach(l => l.sessions.forEach((s, si) => {
    for (const f of FIELDS) {
      const lines = String(s[f] || '').split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!/^##/.test(lines[i]) || !isSelfExercise(lines[i])) continue;
        const m = (lines[i + 1] || '').match(/^\[\[img:img\/([^|\]]+)/);
        if (!m || !isFullPage(m[1])) continue;
        hits.push(`${g}|${l.code} ح${si + 1} · ${lines[i].replace(/^##\s*/, '').slice(0, 44)} ← ${m[1]}`);
        if (apply) { lines.splice(i + 1, 1); s[f] = lines.join('\n'); }
      }
    }
  })));
  if (apply) for (const g of ['8', '9']) writeCurriculum(g, C[g]);
  return hits;
}

const apply = process.argv.includes('--apply');
const hits = run(apply);
console.log(`${apply ? 'نُزعت' : 'ستُنزع'} ${hits.length} صورة صفحة كاملة من تحت «التمارين الذاتية»`);
hits.slice(0, 8).forEach(h => console.log('  ' + h));
if (hits.length > 8) console.log(`  … و${hits.length - 8} غيرها`);
