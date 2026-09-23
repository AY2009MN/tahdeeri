/* مواضع الإدراج الفارغة التي صار لها صورة : ‎[[slot:مثال (١) ص(١٦٧)]]‎ يسبقه
   عنوانٌ فيه العنوان نفسه ثمّ ‎[[img:…]]‎ ـ فالموضع دعوةٌ إلى تكرار صورةٍ مدرجة.
   بلا وسيط : تقرير. مع ‎--apply‎ : حذفها من المنهج.
   الاستعمال : node build/stale-slots.cjs [--apply] */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const apply = process.argv.includes('--apply');

const walk = (node, at, out) => {
  if (Array.isArray(node)) return node.forEach((x, i) => walk(x, at.concat(i), out));
  if (node && typeof node === 'object') {
    for (const k of ['show', 'show2'])
      if (typeof node[k] === 'string') out.push({ at: at.concat(k), text: node[k] });
    return Object.keys(node).forEach(k => walk(node[k], at.concat(k), out));
  }
};

/** أسطر النصّ : عنوان ← صورة ← موضع بالعنوان نفسه = موضعٌ فائض */
function staleSlots(text) {
  const lines = text.split('\n');
  const bad = [];
  let head = '', imgSinceHead = false;
  lines.forEach((ln, i) => {
    if (/^##/.test(ln)) { head = ln; imgSinceHead = false; return; }
    if (/^\[\[img:/.test(ln)) { imgSinceHead = true; return; }
    const m = ln.match(/^\[\[slot:(.+?)\]\]$/);
    if (m && imgSinceHead && head.includes(m[1].trim())) bad.push({ i, label: m[1].trim(), head });
  });
  return bad;
}

let total = 0, files = 0;
for (const file of ['js/data/curriculum8.js', 'js/data/curriculum9.js']) {
  const p = path.join(ROOT, file);
  let src = fs.readFileSync(p, 'utf8');
  const start = src.indexOf('{'), end = src.lastIndexOf('}') + 1;
  const head = src.slice(0, start), tail = src.slice(end);
  const data = JSON.parse(src.slice(start, end));

  const fields = [];
  walk(data, [], fields);
  let n = 0;
  for (const f of fields) {
    const bad = staleSlots(f.text);
    if (!bad.length) continue;
    n += bad.length;
    console.log(`${file} ${f.at.join('/')}`);
    bad.forEach(b => console.log(`   ✗ [[slot:${b.label}]]  ← ${b.head.slice(0, 60)}`));
    if (apply) {
      const keep = f.text.split('\n').filter((_, i) => !bad.some(b => b.i === i));
      let node = data;
      for (const k of f.at.slice(0, -1)) node = node[k];
      node[f.at[f.at.length - 1]] = keep.join('\n');
    }
  }
  if (n) { files++; total += n; }
  if (apply && n) {
    fs.writeFileSync(p, head + JSON.stringify(data, null, 2) + tail);
    console.log(`   ← كُتب ${file}`);
  }
}
console.log(`\n${apply ? 'حُذف' : 'وُجد'} ${total} موضعاً فائضاً في ${files} ملفاً` +
            (apply ? '' : '  (أضِف --apply للحذف)'));
