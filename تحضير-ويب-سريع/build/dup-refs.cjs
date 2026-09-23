/* أين تتكرّر الصورة الواحدة في المنهج ؟
   تكرارُها في حصّتين ليس خطأً دائماً (قاعدةٌ تُعاد) ، لكنّه في حصةٍ واحدة خطأ ،
   وفي درسٍ واحدٍ مَظِنّة خطأ ـ فالقائمة للمراجعة بالعين.
       node build/dup-refs.cjs [8|9] */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const g = process.argv[2] || '9';

const src = fs.readFileSync(path.join(ROOT, `js/data/curriculum${g}.js`), 'utf8');
const data = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));

const use = {};
for (const U of data.units)
  for (const L of U.lessons)
    L.sessions.forEach((x, si) => {
      for (const f of ['show', 'show2'])
        String(x[f] || '').split('\n').forEach(ln => {
          const m = ln.match(/^\[\[img:img\/([^|\]]+)/);
          if (m) (use[m[1]] = use[m[1]] || []).push({ where: `${L.code}#${si + 1}`, lesson: L.code, ses: si, f });
        });
    });

let same = 0, lesson = 0, far = 0;
for (const [img, list] of Object.entries(use)) {
  if (list.length < 2) continue;
  const inSameSession = list.some((a, i) => list.slice(i + 1).some(b => b.lesson === a.lesson && b.ses === a.ses));
  const inSameLesson = list.some((a, i) => list.slice(i + 1).some(b => b.lesson === a.lesson && b.ses !== a.ses));
  const tag = inSameSession ? '‼ حصةٌ واحدة' : inSameLesson ? '⚠ درسٌ واحد' : '· دروسٌ متباعدة';
  if (inSameSession) same++; else if (inSameLesson) lesson++; else far++;
  console.log(`${tag}  ${img}`);
  console.log(`      ${list.map(x => x.where + '/' + x.f).join('  ،  ')}`);
}
console.log(`\nفي حصةٍ واحدة: ${same} ، في درسٍ واحد: ${lesson} ، في دروسٍ متباعدة: ${far}`);
