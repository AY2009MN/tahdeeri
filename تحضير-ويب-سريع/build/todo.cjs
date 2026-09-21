/* يسرد العناوين التي تسمّي عنصراً من الكتاب ولمّا تُلحَق به صورته.
       node build/todo.cjs            كلّها ، مجمّعةً بالصفحات
       node build/todo.cjs 8 ١        وحدةٌ بعينها                          */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = {};
for (const g of ['8', '9']) eval(fs.readFileSync(path.join(ROOT, 'js/data/curriculum' + g + '.js'), 'utf8'));
const C = { 8: window.CURRICULUM_8, 9: window.CURRICULUM_9 };
const F = ['intro', 'show', 'show2', 'close', 'evalx'];
const NEED = /مثال|دورك الآن|اِستكشِف|استكشف|خذ وناقش|حلّ وناقش|فكّر وناقش|نشاط/;
const SELF = /تمارين ذاتية|تمرين ذاتي/;
const AR = '٠١٢٣٤٥٦٧٨٩';
const num = s => { let n = ''; for (const c of s) { const i = AR.indexOf(c); if (i >= 0) n += i; else if (/[0-9]/.test(c)) n += c; } return n ? +n : null; };

function scan() {
  const out = [];
  for (const g of ['8', '9']) C[g].units.forEach(u => u.lessons.forEach(l => l.sessions.forEach((s, si) => {
    for (const f of F) {
      const L = String(s[f] || '').split('\n');
      L.forEach((ln, i) => {
        if (!/^##/.test(ln) || !NEED.test(ln) || SELF.test(ln)) return;
        if (/^\[\[img:img\//.test(L[i + 1] || '')) return;
        out.push({ g, unit: u.name || u.title || '', code: l.code, ses: si, field: f,
                   page: num((ln.match(/ص\s*\(?\s*([٠-٩0-9]+)/) || [])[1] || ''),
                   head: ln.replace(/^##\s*/, '') });
      });
    }
  })));
  return out;
}

module.exports = { scan };

if (require.main === module) {
  const [g, unit] = process.argv.slice(2);
  let rows = scan();
  if (g) rows = rows.filter(r => r.g === g);
  if (unit) rows = rows.filter(r => r.code.startsWith(unit));
  const pages = [...new Set(rows.map(r => r.page))].sort((a, b) => a - b);
  rows.forEach(r => console.log(`${r.g} ${r.code} ح${r.ses + 1} ${r.field.padEnd(5)} ص${String(r.page).padEnd(4)} ${r.head}`));
  console.log('\nالمجموع ' + rows.length + ' عنوان على ' + pages.length + ' صفحة :\n  ' + pages.join(' '));
}
