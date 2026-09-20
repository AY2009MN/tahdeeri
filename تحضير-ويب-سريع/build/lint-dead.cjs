/* يبحث عن دوالّ معرَّفة لا يستعملها شيء ـ تشغيل: node build/lint-dead.cjs */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const A = require(path.join(ROOT, 'js', 'assets.js'));
const files = A.jsPaths().filter(f => !/curriculum|gallery|bookmap/.test(f));
const defs = {}, src = {};
for (const f of files) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8'); src[f] = s;
  for (const m of s.matchAll(/^\s*(?:async\s+)?function\s+(\w+)/gm)) defs[m[1]] = f;
  for (const m of s.matchAll(/^(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(?[\w,\s={}]*\)?\s*=>/gm)) defs[m[1]] = f;
}
const all = Object.values(src).join('\n') + fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dead = [];
for (const [name, f] of Object.entries(defs)) {
  const uses = [...all.matchAll(new RegExp('(?<![.\w$])' + name + '(?![\w$])', 'g'))].length;
  if (uses <= 1) dead.push(`${name}  ←  ${f}`);
}
console.log('دوالّ معرَّفة :', Object.keys(defs).length);
console.log('بلا استعمال  :', dead.length ? '\n  ' + dead.join('\n  ') : 'لا شيء ✓');
