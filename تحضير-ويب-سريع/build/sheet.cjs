/* ورقة تباين : صفحات الكتاب جنباً إلى جنب ، وقد أُطّر كلُّ نطاقٍ ورُقّم.
   تُقرأ بالعين لاختيار النطاق الذي يخصّ كلّ عنوان.
       node build/sheet.cjs <صف> <صفحة> [صفحة…]   →  img/zz_sheet.png        */
const { renderPage, save, createCanvas } = require('./book.cjs');
const { textCols, fine } = require('./segment.cjs');
const SCALE = 1.5;

(async () => {
  const [g, ...pp] = process.argv.slice(2);
  const rs = [];
  for (const p of pp) {
    const r = await renderPage(g, +p, SCALE);
    rs.push({ p, r, c: textCols(r), f: fine(r) });
  }
  const W = rs.reduce((a, x) => a + x.r.w + 16, 0), H = Math.max(...rs.map(x => x.r.h)) + 40;
  const o = createCanvas(W, H), cx = o.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H);
  let x = 8;
  for (const { p, r, c, f } of rs) {
    cx.drawImage(r.cv, x, 32);
    cx.fillStyle = '#000'; cx.font = 'bold 20px sans-serif'; cx.fillText('p' + p, x + 4, 24);
    f.forEach((b, i) => {
      cx.strokeStyle = '#e00'; cx.lineWidth = 3;
      cx.strokeRect(x + c.x0, 32 + b.t, c.x1 - c.x0, b.b - b.t);
      cx.fillStyle = '#e00'; cx.fillRect(x + c.x0 - 30, 32 + b.t, 28, 26);
      cx.fillStyle = '#fff'; cx.font = 'bold 18px sans-serif'; cx.fillText(String(i), x + c.x0 - 22, 32 + b.t + 19);
    });
    x += r.w + 16;
  }
  save(o, 'zz_sheet.png');
  console.log(rs.map(r => 'ص' + r.p + ': ' + r.f.length + ' نطاقات').join('  |  '));
})();
