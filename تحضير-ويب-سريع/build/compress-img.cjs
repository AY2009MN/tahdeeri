/* يضغط صور الكتاب في img/ ضغطاً يخفض الحجم إلى نحو الخُمس بلا فرق مرئي.

   لماذا ينفع هنا : هذه الصور نصّ ورسوم خطّية وتعبئات مسطّحة ، لا صور
   فوتوغرافية. فحصرُ ألوانها في لوحة (palette) يحذف تدرّجات لا وجود لها
   أصلاً ، ويبقى الحرف حادّاً والخطّ نظيفاً. والشفافية محفوظة.

   يُشغَّل بعد إضافة لقطات جديدة :
       npm i sharp            (مرّة واحدة ، خارج المستودع أو فيه)
       node build/compress-img.cjs [--dry]

   التطبيق نفسه لا يحتاج أيّ حزمة ـ هذه أداة صيانة فقط.              */

const fs = require('fs'), path = require('path');
let sharp;
try { sharp = require('sharp'); }
catch {
  console.error('يحتاج حزمة sharp :  npm i sharp');
  process.exit(1);
}

const IMG = path.join(__dirname, '..', 'img');
const DRY = process.argv.includes('--dry');
const kb = n => (n / 1024).toFixed(0);

(async () => {
  const files = fs.readdirSync(IMG).filter(f => /\.png$/i.test(f)).sort();
  let before = 0, after = 0, shrunk = 0, kept = 0;

  for (const f of files) {
    const fp = path.join(IMG, f);
    const size = fs.statSync(fp).size;
    before += size;
    const buf = await sharp(fp)
      .png({ palette: true, colours: 256, effort: 10, compressionLevel: 9 })
      .toBuffer();

    // لا نكتب إلّا إن كسبنا فعلاً ـ بعض الصور مضغوطة أصلاً
    if (buf.length < size * 0.97) {
      if (!DRY) fs.writeFileSync(fp, buf);
      after += buf.length; shrunk++;
    } else { after += size; kept++; }
  }

  console.log(`${files.length} صورة : صُغّرت ${shrunk} ، بقيت ${kept} كما هي`);
  console.log(`${kb(before)} ك.ب ← ${kb(after)} ك.ب  (${Math.round((1 - after / before) * 100)}٪ أقلّ)`);
  if (DRY) console.log('(تجربة فقط ـ لم يُكتب شيء)');
})();
