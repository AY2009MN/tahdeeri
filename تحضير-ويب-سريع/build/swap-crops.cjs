/* يستبدل صور الصفحات الكاملة بقصاصات العنصر المطلوب وحده.
   المعلّم قال : «نريد فقط ما نحتاجه بدقّة» ـ فلكلّ عنوان قصاصة عنصره لا ورقته.

       node build/swap-crops.cjs build/crops.json            يعرض
       node build/swap-crops.cjs build/crops.json --apply    يبدّل

   المطابقة بالعنوان نفسه لا بموضع السطر ، فلا يضرّها أيّ تعديل سابق.       */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

global.window = {};
for (const g of ['8', '9']) eval(fs.readFileSync(path.join(ROOT, 'js/data/curriculum' + g + '.js'), 'utf8'));
const C = { 8: window.CURRICULUM_8, 9: window.CURRICULUM_9 };

function writeCurriculum(g, obj) {
  const p = path.join(ROOT, 'js/data/curriculum' + g + '.js');
  const src = fs.readFileSync(p, 'utf8');
  const marker = `window.CURRICULUM_${g} = `;
  const head = src.slice(0, src.indexOf(marker) + marker.length);
  const tail = src.slice(src.lastIndexOf('}') + 1);
  fs.writeFileSync(p, head + JSON.stringify(obj, null, 2) + tail, 'utf8');
}

const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const apply = process.argv.includes('--apply');
const ok = [], bad = [];

for (const r of rows) {
  const lesson = C[r.g].units.flatMap(u => u.lessons).find(l => l.code === r.code);
  const s = lesson && lesson.sessions[r.ses];
  const lines = s ? String(s[r.field] || '').split('\n') : [];
  const i = lines.findIndex(l => l.replace(/^##\s*/, '').trim() === r.head.trim());
  const m = i >= 0 && (lines[i + 1] || '').match(/^\[\[img:img\/([^|\]]+)\|(\d+)\]\]$/);
  if (!m || m[1] !== r.old) { bad.push(`${r.code} · ${r.head.slice(0, 30)} ← ${m ? m[1] : 'لا سطر صورة'}`); continue; }
  if (r.neu === null) { lines.splice(i + 1, 1); ok.push(`${r.old} ← حُذفت (لا مقابل لها في الكتاب)`); }
  else { lines[i + 1] = `[[img:img/${r.neu}|89]]`; ok.push(`${r.old} → ${r.neu}`); }
  if (apply) s[r.field] = lines.join('\n');
}

if (apply && !bad.length) for (const g of ['8', '9']) writeCurriculum(g, C[g]);
console.log(`${apply && !bad.length ? 'بُدّلت' : 'ستُبدّل'} ${ok.length} صورة`);
ok.forEach(x => console.log('  ' + x));
if (bad.length) { console.log(`\nتعذّر ${bad.length} ـ لم يُكتب شيء :`); bad.forEach(x => console.log('  ✗ ' + x)); process.exit(1); }
