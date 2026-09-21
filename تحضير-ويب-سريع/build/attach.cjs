/* يُلحق القصاصات بعناوينها. الترتيب هو ترتيب build/todo.cjs نفسه ، فيكفي
   سردُ الأسماء بالتتابع (سطرٌ لكلّ عنوان ، و«-» لعنوانٍ نتخطّاه).

       node build/attach.cjs 8 build/names8.txt          يعرض
       node build/attach.cjs 8 build/names8.txt --apply  يُلحق

   يتحقّق قبل الكتابة : الملفّ موجود ، والعنوان بلا صورة ، والعدد مطابق.  */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const { scan } = require('./todo.cjs');

const [g, listFile] = process.argv.slice(2);
const apply = process.argv.includes('--apply');
const names = fs.readFileSync(listFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const rows = scan().filter(r => r.g === g);

if (rows.length !== names.length) {
  console.error(`العناوين ${rows.length} والأسماء ${names.length} ـ لا تتطابق. لم يُكتب شيء.`);
  process.exit(1);
}

global.window = {};
for (const gg of ['8', '9']) eval(fs.readFileSync(path.join(ROOT, 'js/data/curriculum' + gg + '.js'), 'utf8'));
const C = { 8: window.CURRICULUM_8, 9: window.CURRICULUM_9 };

function writeCurriculum(gg, obj) {
  const p = path.join(ROOT, 'js/data/curriculum' + gg + '.js');
  const src = fs.readFileSync(p, 'utf8');
  const marker = `window.CURRICULUM_${gg} = `;
  fs.writeFileSync(p, src.slice(0, src.indexOf(marker) + marker.length)
    + JSON.stringify(obj, null, 2) + src.slice(src.lastIndexOf('}') + 1), 'utf8');
}

const ok = [], bad = [];
/* نبحث عن العنوان بنصّه في كلّ مرّة ، فلا يضرّنا انزياح السطور بعد الإلحاق */
const pairs = rows.map((r, i) => ({ r, name: names[i] })).filter(x => x.name !== '-');
for (const { r, name } of pairs) {
  if (!fs.existsSync(path.join(ROOT, 'img', name))) { bad.push(`${name} ← لا ملفّ بهذا الاسم`); continue; }
  const lesson = C[r.g].units.flatMap(u => u.lessons).find(l => l.code === r.code);
  const s = lesson && lesson.sessions[r.ses];
  const lines = String(s[r.field] || '').split('\n');
  const i = lines.findIndex(l => l.replace(/^##\s*/, '').trim() === r.head.trim());
  if (i < 0) { bad.push(`${r.code} · ${r.head.slice(0, 32)} ← لا عنوان بهذا النصّ`); continue; }
  if (/^\[\[img:img\//.test(lines[i + 1] || '')) { bad.push(`${r.code} · ${r.head.slice(0, 32)} ← عليه صورة أصلاً`); continue; }
  lines.splice(i + 1, 0, `[[img:img/${name}|89]]`);
  if (apply) s[r.field] = lines.join('\n');
  ok.push(`${name}  ← ${r.code} · ${r.head.slice(0, 36)}`);
}

if (apply && !bad.length) writeCurriculum(g, C[g]);
console.log(`${apply && !bad.length ? 'أُلحقت' : 'ستُلحق'} ${ok.length} قصاصة` + (bad.length ? '' : ' ✓'));
ok.slice(0, 6).forEach(x => console.log('  ' + x));
if (ok.length > 6) console.log(`  … و${ok.length - 6} غيرها`);
if (bad.length) { console.log(`\nتعذّر ${bad.length} ـ لم يُكتب شيء :`); bad.forEach(x => console.log('  ✗ ' + x)); process.exit(1); }
