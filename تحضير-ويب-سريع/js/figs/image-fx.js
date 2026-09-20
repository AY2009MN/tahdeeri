/* ═══ معالجة الصور ═══
   ضغط قبل الحفظ ، تفريغ الخلفية البيضاء ، وقصّ الحواف الفارغة.
   كلّها تعمل على لوحة canvas محلّياً ـ لا يُرفع شيء إلى الإنترنت. */

/** يحمّل صورة من عنوان ويعيد عنصر Image جاهزاً */
const loadImage = src => new Promise((res, rej) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = src;
});

/** لوحة بمقاس الصورة وقد رُسمت عليها */
function canvasOf(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

/** ضغط الصورة قبل الحفظ حتى لا تتضخّم قاعدة البيانات */
function shrinkImage(file, maxW, quality) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc);
      c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', quality));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

/** تفريغ الخلفية البيضاء : البكسل شبه الأبيض يصير شفّافاً بتدرّج ناعم */
async function removeWhite(src) {
  const c = canvasOf(await loadImage(src));
  const cx = c.getContext('2d');
  const im = cx.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    if (mn >= 248 && mx - mn <= 6) d[i + 3] = 0;
    else if (mn >= 236 && mx - mn <= 8) d[i + 3] = Math.round(255 - ((mn - 236) / 12) * 255);
  }
  cx.putImageData(im, 0, 0);
  return c.toDataURL('image/png');
}

/** حدود الحبر في الصورة ـ أصغر مستطيل يضمّ كلّ ما ليس خلفية */
function inkBounds(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let t = c.height, l = c.width, r = -1, b = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      const ink = d[i + 3] > 24 && !(d[i] > 246 && d[i + 1] > 246 && d[i + 2] > 246);
      if (ink) { if (y < t) t = y; if (y > b) b = y; if (x < l) l = x; if (x > r) r = x; }
    }
  return r < l || b < t ? null : { l, t, w: r - l + 1, h: b - t + 1 };
}

/** قصّ الحواف الفارغة وضبط أقصى عرض ـ يبقى هامش صغير حول المحتوى */
async function trimImage(src, { pad = 6, maxW = 1400 } = {}) {
  const c = canvasOf(await loadImage(src));
  const bb = inkBounds(c);
  if (!bb) return src;
  const k = Math.min(1, maxW / (bb.w + pad * 2));
  const o = document.createElement('canvas');
  o.width = Math.round((bb.w + pad * 2) * k);
  o.height = Math.round((bb.h + pad * 2) * k);
  const ox = o.getContext('2d');
  ox.imageSmoothingQuality = 'high';
  ox.drawImage(c, bb.l, bb.t, bb.w, bb.h, pad * k, pad * k, bb.w * k, bb.h * k);
  return o.toDataURL('image/png');
}

/** تنظيف لقطة الكتاب : تفريغ خلفية ثم قصّ حواف ـ يتجاوز ما يفشل منهما */
async function cleanShot(url, doWhite = true) {
  let out = url;
  if (doWhite) { try { out = await removeWhite(out); } catch {} }
  try { out = await trimImage(out); } catch {}
  return out;
}
