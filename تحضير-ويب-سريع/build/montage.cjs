/* يرصّ قصاصاتٍ في ورقةٍ واحدة لمراجعتها بالعين دفعةً واحدة.
       node build/montage.cjs a.png b.png …     →  img/zz_montage.png       */
const fs = require('fs'), path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const IMG = path.join(__dirname, '..', 'img');

(async () => {
  const names = process.argv.slice(2);
  const COLS = Math.min(5, names.length), CW = 330;
  const imgs = [];
  for (const n of names) {
    const im = await loadImage(fs.readFileSync(path.join(IMG, n)));
    imgs.push({ n, im, h: Math.round(im.height * CW / im.width) });
  }
  const rows = [];
  for (let i = 0; i < imgs.length; i += COLS) rows.push(imgs.slice(i, i + COLS));
  const H = rows.reduce((a, r) => a + Math.max(...r.map(x => x.h)) + 26, 0);
  const cv = createCanvas(COLS * (CW + 8), H), cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
  let y = 0;
  for (const r of rows) {
    const rh = Math.max(...r.map(x => x.h));
    r.forEach((x, i) => {
      const px = i * (CW + 8);
      cx.fillStyle = '#c00'; cx.font = 'bold 15px sans-serif'; cx.fillText(x.n, px + 2, y + 17);
      cx.drawImage(x.im, px, y + 22, CW, x.h);
      cx.strokeStyle = '#c00'; cx.lineWidth = 2; cx.strokeRect(px, y + 22, CW, x.h);
    });
    y += rh + 26;
  }
  fs.writeFileSync(path.join(IMG, 'zz_montage.png'), cv.toBuffer('image/png'));
  console.log('zz_montage.png ' + cv.width + '×' + cv.height + '  (' + names.length + ' قصاصة)');
})();
