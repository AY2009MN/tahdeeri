/* يزيل قصاصاتٍ أضفتُها وكانت تكرّر صورةً أصلية في الحصة نفسها.
   تحقّقت المطابقة بالبكسل ثمّ بالعين ، ملفاً ملفاً.                        */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = {};
for (const g of ['8', '9']) eval(fs.readFileSync(path.join(ROOT, 'js/data/curriculum' + g + '.js'), 'utf8'));
const C = { 8: window.CURRICULUM_8, 9: window.CURRICULUM_9 };
const F = ['intro', 'show', 'show2', 'close', 'evalx'];
const DROP = new Set(['g8-1-7_p59_c1.png', 'g9-1-3_p34_c1.png',
                      'g9-2-3_p83_c1.png', 'g9-2-5_p95_c1.png', 'g9-2-6_p102_c1.png']);

function writeCurriculum(g, obj) {
  const p = path.join(ROOT, 'js/data/curriculum' + g + '.js');
  const src = fs.readFileSync(p, 'utf8');
  const m = `window.CURRICULUM_${g} = `;
  fs.writeFileSync(p, src.slice(0, src.indexOf(m) + m.length) + JSON.stringify(obj, null, 2) + src.slice(src.lastIndexOf('}') + 1), 'utf8');
}

const apply = process.argv.includes('--apply');
const hits = [];
for (const g of ['8', '9']) C[g].units.forEach(u => u.lessons.forEach(l => l.sessions.forEach((s, si) => {
  for (const f of F) {
    const L = String(s[f] || '').split('\n');
    const keep = [];
    for (let i = 0; i < L.length; i++) {
      const m = L[i].match(/^\[\[img:img\/([^|\]]+)\|/);
      if (m && DROP.has(m[1])) {
        hits.push(`${g} ${l.code} ح${si + 1} · ${m[1]} ← ${(L[i - 1] || '').replace(/^##\s*/, '').slice(0, 40)}`);
        continue;
      }
      keep.push(L[i]);
    }
    if (apply && keep.length !== L.length) s[f] = keep.join('\n');
  }
})));
if (apply) for (const g of ['8', '9']) writeCurriculum(g, C[g]);
console.log(`${apply ? 'أُزيلت' : 'ستُزال'} ${hits.length} قصاصة مكرّرة`);
hits.forEach(h => console.log('  ' + h));
