/* يجمع index.html من أجزاء html/ وقائمة js/assets.js.
   يعمل آلياً عند تشغيل الخادم ، ويمكن تشغيله وحده :
       node build/build-html.cjs
   لا تحرّر index.html مباشرة ـ حرّر الجزء المناسب في مجلد html/. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'html');
const A = require(path.join(ROOT, 'js', 'assets.js'));

function build() {
  let out = fs.readFileSync(path.join(HTML, 'index.template.html'), 'utf8');

  out = out.replace('<!--#styles-->',
    A.cssPaths().map(p => `<link rel="stylesheet" href="${p}?v=${A.VERSION}">`).join('\n'));

  out = out.replace(/<!--#include ([\w.-]+)-->/g, (m, file) => {
    const fp = path.join(HTML, file);
    if (!fs.existsSync(fp)) throw new Error('جزء مفقود: ' + file);
    return fs.readFileSync(fp, 'utf8').trimEnd();
  });

  const head = '<!-- مولَّد آلياً من مجلد html/ بـ build/build-html.cjs ـ لا يُحرَّر يدوياً -->\n';
  const target = path.join(ROOT, 'index.html');
  const next = out.replace('<html', head.trimEnd() + '\n<html');
  const prev = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (prev !== next) fs.writeFileSync(target, next, 'utf8');
  return prev !== next;
}

if (require.main === module) {
  try { console.log(build() ? 'حُدّث index.html' : 'index.html محدَّث أصلاً'); }
  catch (e) { console.error('تعذّر البناء:', e.message); process.exit(1); }
}

module.exports = build;
