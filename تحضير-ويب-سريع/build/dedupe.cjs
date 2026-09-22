/* يزيل تكرار الصورة الواحدة داخل الحصة الواحدة.
   حين يسمّي عنوانان عنصرَ الكتاب نفسه (الفكرة ومثالها مثلاً) كنّا نُلحق
   القصاصة بكليهما ، فتظهر مرّتين في الورقة الواحدة ـ وهو ما يراه المعلّم
   خطأً. تبقى الصورة عند أوّل عنوانٍ يسمّيها ، ويبقى للثاني نصّه وصفحته.

       node build/dedupe.cjs            يعرض
       node build/dedupe.cjs --apply    ينفّذ                                */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = {};
for (const g of ['8', '9']) eval(fs.readFileSync(path.join(ROOT, 'js/data/curriculum' + g + '.js'), 'utf8'));
const C = { 8: window.CURRICULUM_8, 9: window.CURRICULUM_9 };
const F = ['intro', 'show', 'show2', 'close', 'evalx'];

function writeCurriculum(g, obj) {
  const p = path.join(ROOT, 'js/data/curriculum' + g + '.js');
  const src = fs.readFileSync(p, 'utf8');
  const marker = `window.CURRICULUM_${g} = `;
  fs.writeFileSync(p, src.slice(0, src.indexOf(marker) + marker.length)
    + JSON.stringify(obj, null, 2) + src.slice(src.lastIndexOf('}') + 1), 'utf8');
}

const apply = process.argv.includes('--apply');
const hits = [];
for (const g of ['8', '9']) C[g].units.forEach(u => u.lessons.forEach(l => l.sessions.forEach((s, si) => {
  const seen = new Set();
  for (const f of F) {
    const L = String(s[f] || '').split('\n');
    for (let i = L.length - 1; i >= 0; i--) { }        // نمرّ صعوداً لاحقاً
  }
  // نمرّ بترتيب الحقول والسطور ، ونحذف التكرار الثاني فما بعده
  for (const f of F) {
    const L = String(s[f] || '').split('\n');
    const keep = [];
    for (let i = 0; i < L.length; i++) {
      const m = L[i].match(/^\[\[img:img\/([^|\]]+)\|/);
      if (m) {
        if (seen.has(m[1])) {
          hits.push(`${g} ${l.code} ح${si + 1} · ${m[1]} ← ${(L[i - 1] || '').replace(/^##\s*/, '').slice(0, 38)}`);
          continue;                                     // يُحذف السطر
        }
        seen.add(m[1]);
      }
      keep.push(L[i]);
    }
    if (apply && keep.length !== L.length) s[f] = keep.join('\n');
  }
})));
if (apply) for (const g of ['8', '9']) writeCurriculum(g, C[g]);
console.log(`${apply ? 'حُذفت' : 'ستُحذف'} ${hits.length} صورة مكرّرة داخل حصّتها`);
hits.forEach(h => console.log('  ' + h));
