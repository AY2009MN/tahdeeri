/* حين يتقاسم عنوانان عنصرَ الكتاب نفسه ، فالصورة أولى بالعنوان الذي يسمّيه :
   القصاصة هي المثال المحلول ، فتُوضع تحت «مثال (…)» ويبقى لـ«الفكرة» نصّها.
   (كانت التنقية تُبقيها عند الأوّل ترتيباً ، وهو الفكرة غالباً.)

       node build/prefer-example.cjs [--apply]                              */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = {};
for (const g of ['8', '9']) eval(fs.readFileSync(path.join(ROOT, 'js/data/curriculum' + g + '.js'), 'utf8'));
const C = { 8: window.CURRICULUM_8, 9: window.CURRICULUM_9 };
const F = ['intro', 'show', 'show2', 'close', 'evalx'];
const AR = '٠١٢٣٤٥٦٧٨٩';
const num = s => { let n = ''; for (const c of s) { const i = AR.indexOf(c); if (i >= 0) n += i; } return n ? +n : null; };
const pageOf = h => num((h.match(/ص\s*\(?\s*([٠-٩]+)/) || [])[1] || '');
const isIdea = h => /الفكرة|مناقشة|^\s*[٠-٩]\)\s*(قاعدة|خواص|مفهوم|تحقّق)/.test(h);
const isExample = h => /مثال/.test(h);

function writeCurriculum(g, obj) {
  const p = path.join(ROOT, 'js/data/curriculum' + g + '.js');
  const src = fs.readFileSync(p, 'utf8');
  const m = `window.CURRICULUM_${g} = `;
  fs.writeFileSync(p, src.slice(0, src.indexOf(m) + m.length) + JSON.stringify(obj, null, 2) + src.slice(src.lastIndexOf('}') + 1), 'utf8');
}

const apply = process.argv.includes('--apply');
const moves = [];
for (const g of ['8', '9']) C[g].units.forEach(u => u.lessons.forEach(l => l.sessions.forEach((s, si) => {
  // كلّ العناوين في الحصة مع صورها
  const rows = [];
  for (const f of F) {
    const L = String(s[f] || '').split('\n');
    L.forEach((ln, i) => {
      if (!/^##/.test(ln)) return;
      const head = ln.replace(/^##\s*/, '');
      const m = (L[i + 1] || '').match(/^\[\[img:img\/([^|\]]+)\|(\d+)\]\]$/);
      rows.push({ f, i, head, img: m ? m[1] : null, w: m ? m[2] : '89' });
    });
  }
  for (const src of rows) {
    if (!src.img || !isIdea(src.head)) continue;
    const p = pageOf(src.head);
    const dst = rows.find(r => !r.img && isExample(r.head) && pageOf(r.head) === p);
    if (!dst) continue;
    moves.push(`${g} ${l.code} ح${si + 1} · ${src.img}\n    من: ${src.head.slice(0, 44)}\n    إلى: ${dst.head.slice(0, 44)}`);
    if (apply) {
      const A = String(s[src.f]).split('\n'); A.splice(src.i + 1, 1); s[src.f] = A.join('\n');
      const B = String(s[dst.f]).split('\n');
      const j = B.findIndex(x => x.replace(/^##\s*/, '') === dst.head);
      B.splice(j + 1, 0, `[[img:img/${src.img}|${src.w}]]`); s[dst.f] = B.join('\n');
    }
    src.img = null; dst.img = 'x';
  }
})));
if (apply) for (const g of ['8', '9']) writeCurriculum(g, C[g]);
console.log(`${apply ? 'نُقلت' : 'ستُنقل'} ${moves.length} صورة إلى عنوان المثال`);
moves.forEach(m => console.log('  ' + m));
