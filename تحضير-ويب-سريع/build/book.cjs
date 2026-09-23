/* أدوات قصّ عناصر الكتاب ـ تعمل في Node بلا متصفّح.

   لماذا : قصّ العناصر كان يجري داخل لوحة المتصفّح ، وهي تتوقّف عن الرسم حين
   تُخفى. هنا نفتح الـ PDF مباشرةً فيبقى العمل قابلاً للإعادة والمراجعة.

   الاستعمال (بعد  npm i pdfjs-dist@4 @napi-rs/canvas) :
       node build/sheet.cjs 9 144 145 146      ورقة تباين بنطاقات مرقّمة
       node build/cut.cjs   9 145 0 2 اسم.png   قصّ النطاقات ٠..٢

   pdfPageFromPrinted : ترقيم الكتاب المطبوع مقابل صفحات الملفّ ـ الحدود نفسها
   المقيسة في js/studio/studio-pdf.js ، فأيّ تعديل هناك يُنقل هنا.           */

const fs = require('fs'), path = require('path');
/* حزمة canvas هي التي يعرفها pdf.js في Node : يرقّع منها Path2D و DOMMatrix
   من تلقاء نفسه ، فترسم الحروف مساراتٍ صحيحة. */
/* @napi-rs/canvas وحدها تجمع ما يلزم : Path2D (يرسم بها pdf.js حروف الخطوط
   المضمَّنة ، وبدونها تخرج الصفحة بلا نصّ) و DOMMatrix و ImageData.
   نمدّ بها العالمَ قبل تحميل pdf.js ، وإلّا رقّع هو من حزمةٍ أخرى فاختلفت
   الأنواع ورفضها السياق. */
const nodeCanvas = require('@napi-rs/canvas');
const { createCanvas } = nodeCanvas;
for (const k of ['DOMMatrix', 'Path2D', 'ImageData', 'DOMPoint'])
  if (nodeCanvas[k]) globalThis[k] = nodeCanvas[k];

const ROOT = path.join(__dirname, '..');
const BOOKS = { '8': '8f1.pdf', '9': '9f1.pdf' };
/* كتب الطالب صارت داخل المشروع في «كتب/» بعد نقله من OneDrive. ونُبقي
   الموضع القديم بديلاً ، فلا تتعطّل الأدوات على نسخةٍ لم تُنقل بعد. */
const BOOKDIR = [path.resolve(ROOT, '..', 'كتب'), path.resolve(ROOT, '..', '..')]
  .find(d => fs.existsSync(path.join(d, '9f1.pdf'))) || path.resolve(ROOT, '..', 'كتب');
const IMG = path.join(ROOT, 'img');

const PAGE_SHIFT = { '8': { printed: 124, big: 14 }, '9': { printed: 114, big: 15 } };
const pdfPageFromPrinted = (p, g) => {
  const k = PAGE_SHIFT[g];
  return Math.max(1, p + (k && p >= k.printed ? k.big : 1));
};

/* نسخة pdf.js المرفقة في vendor/ هي نفسها التي يعمل بها التطبيق ، فنستعملها هنا
   أيضاً : أداةٌ واحدة لا تحتاج تثبيت حزمةٍ خارجية ، ولا تختلف عمّا يراه المعلّم.
   (كانت تستورد pdfjs-dist فتتعطّل كلّما نُظّف node_modules) */
let pdfjs;
async function lib() {
  if (pdfjs) return pdfjs;
  const url = require('url').pathToFileURL(path.join(__dirname, '..', 'vendor', 'pdf.mjs'));
  return pdfjs = await import(url.href);
}

const docs = {};
async function book(g) {
  if (docs[g]) return docs[g];
  const p = path.join(BOOKDIR, BOOKS[g]);
  if (!fs.existsSync(p)) throw new Error('لم أجد كتاب الصف ' + g + ' في ' + p);
  const { getDocument } = await lib();
  return docs[g] = await getDocument({ data: new Uint8Array(fs.readFileSync(p)), CanvasFactory }).promise;
}

/* pdf.js يحتاج مصنعَ لوحاتٍ مساعدة للتدرّجات والأقنعة ، وهو في المتصفّح
   ضمنيّ. نزوّده بواحدٍ يبني لوحات node-canvas. */
class CanvasFactory {
  create(width, height) {
    const canvas = createCanvas(Math.max(1, width | 0), Math.max(1, height | 0));
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(cc, width, height) { cc.canvas.width = Math.max(1, width | 0); cc.canvas.height = Math.max(1, height | 0); }
  destroy(cc) { cc.canvas.width = cc.canvas.height = 0; cc.canvas = cc.context = null; }
}

/** يرسم صفحةً مطبوعة بمقياس معيّن ويعيد اللوحة مع بكسلاتها */
async function renderPage(g, printed, scale) {
  const page = await (await book(g)).getPage(pdfPageFromPrinted(printed, g));
  const vp = page.getViewport({ scale });
  const cv = createCanvas(Math.round(vp.width), Math.round(vp.height));
  const cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: cx, viewport: vp }).promise;
  const r = { cv, cx, w: cv.width, h: cv.height };
  r.d = cx.getImageData(0, 0, r.w, r.h).data;
  return r;
}

const save = (cv, name) => fs.writeFileSync(path.join(IMG, name), cv.toBuffer('image/png'));

module.exports = { renderPage, save, pdfPageFromPrinted, IMG, createCanvas };
