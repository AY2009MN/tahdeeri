/* يكشف الصور المتشابهة بصرياً داخل الحصة الواحدة ـ لا بالاسم بل بالبكسل.
   صورتان من ملفّين مختلفين قد تكونان لقطةً واحدة من الكتاب ، فتظهران
   مكرّرتين في الورقة. نحسب لكلّ صورة بصمةً ١٦×١٦ رماديّة ونقارن.

       node build/dup-look.cjs                                            */
const fs = require('fs'), path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ROOT = path.join(__dirname, '..');
global.window = {};
for (const g of ['8', '9']) eval(fs.readFileSync(path.join(ROOT, 'js/data/curriculum' + g + '.js'), 'utf8'));
const C = { 8: window.CURRICULUM_8, 9: window.CURRICULUM_9 };
const F = ['intro', 'show', 'show2', 'close', 'evalx'];

const cache = {};
async function sig(name) {
  if (cache[name]) return cache[name];
  const p = path.join(ROOT, 'img', name);
  if (!fs.existsSync(p)) return cache[name] = null;
  const im = await loadImage(fs.readFileSync(p));
  const N = 16, cv = createCanvas(N, N), cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, N, N);
  cx.drawImage(im, 0, 0, N, N);
  const d = cx.getImageData(0, 0, N, N).data, v = [];
  for (let i = 0; i < d.length; i += 4) v.push((d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) | 0);
  return cache[name] = { v, ar: im.width / im.height };
}
const dist = (a, b) => a.v.reduce((s, x, i) => s + Math.abs(x - b.v[i]), 0) / a.v.length;

(async () => {
  const hits = [];
  for (const g of ['8', '9']) for (const u of C[g].units) for (const l of u.lessons)
    for (const [si, s] of l.sessions.entries()) {
      const imgs = [];
      for (const f of F) {
        const L = String(s[f] || '').split('\n');
        L.forEach((ln, i) => {
          const m = ln.match(/^\[\[img:img\/([^|\]]+)\|/);
          if (m) imgs.push({ name: m[1], f, i, head: (L[i - 1] || '').replace(/^##\s*/, '').slice(0, 40) });
        });
      }
      for (let a = 0; a < imgs.length; a++) for (let b = a + 1; b < imgs.length; b++) {
        const A = await sig(imgs[a].name), B = await sig(imgs[b].name);
        if (!A || !B) continue;
        if (Math.abs(A.ar - B.ar) > 0.12) continue;
        const d = dist(A, B);
        if (d < 8) hits.push({ id: `${g} ${l.code} ح${si + 1}`, d: d.toFixed(1),
          a: imgs[a], b: imgs[b] });
      }
    }
  console.log(`صور متشابهة بصرياً داخل حصّتها : ${hits.length}`);
  hits.forEach(h => console.log(`  ${h.id}  (فرق ${h.d})\n    ${h.a.name}  ← ${h.a.head}\n    ${h.b.name}  ← ${h.b.head}`));
})();
