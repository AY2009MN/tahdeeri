/* تقطيع صفحة الكتاب إلى عناصرها : حدود النصّ ، أشرطة العناوين ، النطاقات.

   الفكرة : صفحة الكتاب أعمدةٌ من عناصر يفصلها بياض ، ويعلو كلَّ عنصرٍ شريطٌ
   ملوّن («مثال (٢)» ، «دورك الآن» ، «اِستكشِف»). فنقطع أوّلاً عند البياض ،
   ثمّ نشقّ ما بقي عند رأس كلّ شريطٍ بداخله ـ فينفصل المثال عن الذي يليه.

   اللسان الملوّن على حافة الصفحة يُستبعَد بالمشي من الحافة إلى الداخل ما دام
   العمود مشبَع اللون في معظم ارتفاعه.                                      */

/** حدود النصّ في الصفحة ، بلا اللسان الجانبيّ ولا الهوامش البيضاء */
function textCols(r) {
  if (r._c) return r._c;
  const { d, w, h } = r;
  const yA = Math.round(h * 0.03), yB = Math.round(h * 0.96);
  const stat = x => {
    let ink = 0, chroma = 0, n = 0;
    for (let y = yA; y < yB; y += 3) {
      n++;
      const i = (y * w + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2];
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if (mx < 245) ink++;
      if (mx - mn > 40) chroma++;
    }
    return { ink: ink / n, chroma: chroma / n };
  };
  /* اللسان الجانبيّ : عمودٌ مشبَع اللون قرب الحافة. بعض الألسنة مستديرة لا
     تبلغ طرفَي الصفحة ، فنكتفي بثلث الارتفاع ما دمنا في الحافة العُشر. */
  const edge = Math.round(w * 0.10);
  let x0 = 0, x1 = w - 1;
  while (x0 < w - 1 && stat(x0).chroma > (x0 < edge ? 0.30 : 0.55)) x0++;
  while (x1 > 0 && stat(x1).chroma > (x1 > w - edge ? 0.30 : 0.55)) x1--;
  while (x0 < x1 && stat(x0).ink < 0.004) x0++;
  while (x1 > x0 && stat(x1).ink < 0.004) x1--;
  const rowInk = y => {
    for (let x = x0; x <= x1; x += 2) {
      const i = (y * w + x) * 4;
      if (Math.max(d[i], d[i + 1], d[i + 2]) < 245) return true;
    }
    return false;
  };
  let y0 = yA, y1 = yB;
  while (y0 < y1 && !rowInk(y0)) y0++;
  while (y1 > y0 && !rowInk(y1)) y1--;
  return r._c = { x0, x1, y0, y1 };
}

/** أشرطة العناوين الملوّنة : صفٌّ مشبَع اللون يمتدّ جزءاً معتبراً من العمود */
function banners(r) {
  if (r._n) return r._n;
  const { d, w } = r, c = textCols(r), W = c.x1 - c.x0 + 1;
  const hit = y => {
    let n = 0;
    for (let x = c.x0; x <= c.x1; x += 2) {
      const i = (y * w + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2];
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if (mx - mn > 45 && mx > 70) n++;
    }
    return n * 2 / W > 0.12;
  };
  const out = [];
  let t = null;
  for (let y = c.y0; y <= c.y1; y++) {
    if (hit(y)) { if (t === null) t = y; }
    else if (t !== null) { if (y - t >= 14 && y - t <= 95) out.push({ t, b: y }); t = null; }
  }
  return r._n = out;
}

/** نطاقات خشنة : تقطيع عند فراغٍ أبيض بارتفاع gap */
function bands(r, gap = 38, minH = 150, pad = 12) {
  if (r._b) return r._b;
  const { d, w } = r, c = textCols(r);
  const ink = y => {
    for (let x = c.x0; x <= c.x1; x += 2) {
      const i = (y * w + x) * 4;
      if (Math.max(d[i], d[i + 1], d[i + 2]) < 242) return true;
    }
    return false;
  };
  const out = [];
  let t = null, blank = 0;
  for (let y = c.y0; y <= c.y1; y++) {
    if (ink(y)) { if (t === null) t = y; blank = 0; }
    else if (t !== null && ++blank >= gap) { out.push({ t: Math.max(c.y0, t - pad), b: y - blank + pad }); t = null; blank = 0; }
  }
  if (t !== null) out.push({ t: Math.max(c.y0, t - pad), b: c.y1 });
  const m = [];
  for (const s of out) {
    const p = m[m.length - 1];
    if (p && (s.t - p.b < gap * 0.6 || p.b - p.t < minH)) p.b = s.b;
    else m.push({ ...s });
  }
  return r._b = m;
}

/** النطاقات النهائية : الخشنة مشقوقةً عند رؤوس الأشرطة بداخلها */
function fine(r, minGap = 38) {
  const bn = banners(r), out = [];
  for (const s of bands(r)) {
    const cuts = bn.map(x => x.t).filter(y => y > s.t + minGap && y < s.b - minGap);
    let prev = s.t;
    for (const y of cuts) { out.push({ t: prev, b: y }); prev = y; }
    out.push({ t: prev, b: s.b });
  }
  return out;
}

module.exports = { textCols, banners, bands, fine };
