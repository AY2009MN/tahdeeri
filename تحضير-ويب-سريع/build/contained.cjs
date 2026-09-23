/* عنوانٌ يحمل صورتين : أهما عنصرٌ واحد أم عنصران ؟
   القياس بالاحتواء لا بالتشابه : تُوحَّد أعرضُهما ، ثمّ تُزلَق الأقصرُ على
   الأطول رأسياً ويُحسب أقلّ فرقٍ متوسّط. فإن كانت الأقصر جزءاً من الأطول
   فالفرق يقارب الصفر ، وهي حينئذٍ مكرّرة تُحذف ويبقى الأوسع.

       node build/contained.cjs [8|9] [--apply]                            */
const fs = require('fs'), path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ROOT = path.join(__dirname, '..'), IMG = path.join(ROOT, 'img');
const g = (process.argv.find(a => a === '8' || a === '9')) || '9';
const apply = process.argv.includes('--apply');
const W = 160, THRESH = 14;                 // عتبة الفرق المتوسّط (٠ـ٢٥٥)

/** رماديّ بعرضٍ موحّد ، فالمقارنة على الشكل لا على المقاس */
async function gray(file) {
  const im = await loadImage(fs.readFileSync(path.join(IMG, file)));
  const h = Math.max(8, Math.round(im.height * W / im.width));
  const c = createCanvas(W, h), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, h);
  x.drawImage(im, 0, 0, W, h);
  const d = x.getImageData(0, 0, W, h).data, out = new Uint8Array(W * h);
  for (let i = 0; i < W * h; i++)
    out[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
  return { px: out, h };
}

/** أقلّ فرقٍ متوسّط حين تُزلَق الصغرى على الكبرى رأسياً */
function slide(small, big) {
  if (small.h > big.h) return slide(big, small);
  let best = 255;
  for (let off = 0; off <= big.h - small.h; off++) {
    let sum = 0;
    for (let i = 0; i < small.h * W; i++) sum += Math.abs(small.px[i] - big.px[off * W + i]);
    best = Math.min(best, sum / (small.h * W));
    if (best < 2) break;
  }
  return best;
}

/** عناوين تحمل صورتين فأكثر */
function pairs(data) {
  const out = [];
  for (const U of data.units) for (const L of U.lessons) L.sessions.forEach((x, si) => {
    for (const f of ['intro', 'show', 'show2', 'close', 'evalx']) {
      let head = '', imgs = [];
      const flush = () => { if (imgs.length > 1) out.push({ L, si, f, head, imgs }); imgs = []; };
      String(x[f] || '').split('\n').forEach(ln => {
        if (/^##/.test(ln)) { flush(); head = ln; return; }
        const m = ln.match(/^\[\[img:img\/([^|\]]+)/); if (m) imgs.push(m[1]);
      });
      flush();
    }
  });
  return out;
}

(async () => {
  const P = path.join(ROOT, `js/data/curriculum${g}.js`);
  const src = fs.readFileSync(P, 'utf8');
  const a = src.indexOf('{'), b = src.lastIndexOf('}') + 1;
  const data = JSON.parse(src.slice(a, b));
  const cache = {};
  const px = async f => cache[f] || (cache[f] = await gray(f));

  let dup = 0, keep = 0;
  const drops = [];
  for (const p of pairs(data)) {
    for (let i = 0; i < p.imgs.length - 1; i++)
      for (let j = i + 1; j < p.imgs.length; j++) {
        const A = await px(p.imgs[i]), B = await px(p.imgs[j]);
        const d = slide(A, B);
        if (d > THRESH) { keep++; continue; }
        dup++;
        const loser = A.h <= B.h ? p.imgs[i] : p.imgs[j];   // الأقصر هي الجزء
        drops.push({ p, loser, keeper: loser === p.imgs[i] ? p.imgs[j] : p.imgs[i], d });
      }
  }
  drops.forEach(x => console.log(
    `${x.p.L.code}#${x.p.si + 1}  ${x.p.head.slice(3, 44)}\n` +
    `    ✗ ${x.loser}   ✓ ${x.keeper}   (فرق ${x.d.toFixed(1)})`));

  if (apply && drops.length) {
    for (const x of drops) {
      const ses = x.p.L.sessions[x.p.si], f = x.p.f;
      ses[f] = String(ses[f]).split('\n')
        .filter(ln => !ln.startsWith(`[[img:img/${x.loser}`)).join('\n');
    }
    fs.writeFileSync(P, src.slice(0, a) + JSON.stringify(data, null, 2) + src.slice(b));
  }
  console.log(`\nالصف ${g}: ${dup} صورة مكرّرة (جزءٌ من أختها) ، و ${keep} زوجاً عنصرُهما مختلف` +
              (apply ? ` ـ حُذفت المكرّرة` : ' (أضِف --apply للحذف)'));
})();
