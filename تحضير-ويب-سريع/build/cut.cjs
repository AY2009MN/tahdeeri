/* يقصّ نطاقاً (أو مدى نطاقات) من صفحة الكتاب ويحفظه قصاصةً في img/.
   الترقيم هو نفسه الذي تعرضه build/sheet.cjs ، فاقرأ الورقة أوّلاً ثمّ اقطع.

       node build/cut.cjs <صف> <صفحة> <من> <إلى> <الاسم.png>
       node build/cut.cjs 9 145 0 2 g9-3-5_p145_c2.png

   القصّ يجري بمقياس ٢٫٦ (جودة الطباعة) وحدوده مأخوذة من تقطيعٍ بمقياس ١٫٥ ،
   وهو المقياس الذي تُرسم به ورقة التباين ـ فما تراه هو ما يُقصّ.          */
const fs = require('fs'), path = require('path');
const { renderPage, save, IMG } = require('./book.cjs');
const { textCols, fine } = require('./segment.cjs');
const { createCanvas } = require('@napi-rs/canvas');

const LOW = 1.5, HIGH = 2.6, PAD = 10;

/** يقصّ بمدى نطاقات ؛ ولو مرّر y0/y1 (بمقياس ١٫٥) قصّ بهما مباشرةً */
async function cut(g, printed, from, to, name, raw) {
  const lo = await renderPage(g, printed, LOW);
  const f = fine(lo);
  if (!raw && (from >= f.length || to >= f.length))
    throw new Error(`ص${printed} فيها ${f.length} نطاقات فقط`);
  const t = raw ? from : f[from].t, b = raw ? to : f[to].b;

  const hi = await renderPage(g, printed, HIGH);
  const c = textCols(hi), k = HIGH / LOW;
  const x0 = Math.max(0, c.x0 - PAD), x1 = Math.min(hi.w, c.x1 + PAD);
  const y0 = Math.max(0, Math.round(t * k) - PAD), y1 = Math.min(hi.h, Math.round(b * k) + PAD);

  /* الكتابة فوق قصاصةٍ قائمة تدهسها صامتةً ـ وقد حدث ذلك مرّتين فظهرت صورةُ
     عنوانٍ تحت عنوانٍ آخر. لا نكتب فوق موجود إلّا بـ --force. */
  if (fs.existsSync(path.join(IMG, name)) && !process.argv.includes('--force'))
    throw new Error(`«${name}» موجودة ـ اختر اسماً آخر أو أضِف --force`);

  const cv = createCanvas(x1 - x0, y1 - y0), cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
  cx.drawImage(hi.cv, x0, y0, cv.width, cv.height, 0, 0, cv.width, cv.height);
  save(cv, name);
  return `${name}  ← ص${printed} ${raw ? 'ص' : 'نطاق '}${from}–${to}  ${cv.width}×${cv.height}`;
}

module.exports = { cut };

if (require.main === module) {
  const [g, p, from, to, name] = process.argv.slice(2);
  const raw = process.argv.includes('--y');
  cut(g, +p, +from, +to, name, raw).then(console.log, e => { console.error(e.message); process.exit(1); });
}
