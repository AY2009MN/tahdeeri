/* خادم محلي بسيط لتشغيل التطبيق على http://localhost:8080 */
const http = require('http'), fs = require('fs'), path = require('path');

/* يُبنى index.html من أجزاء html/ عند كلّ تشغيل ، فلا يبقى قديماً أبداً */
try { require('./tools/build-html.cjs')(); }
catch (e) { console.error('تعذّر بناء index.html:', e.message); }
const root = __dirname, PORT = +process.env.PORT || 8080;
// التطبيق صار داخل مجلد فرعي في المستودع ، فمجلد الكتب أعلى بدرجتين (للتطوير المحلي فقط)
const src = path.resolve(root, "..", "..");
const b64Cache = {};
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml',
  '.pdf':'application/pdf'};

http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);

  /* أدوات التطوير: حفظ قصاصة داخل img/ (من الجهاز نفسه فقط) */
  if (u === '/__save' && req.method === 'POST') {
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const sp = new URL(req.url, 'http://x').searchParams;
    const name = sp.get('name') || '', dir = sp.get('dir') === 'views' ? path.join(root, 'tools', 'views') : path.join(root, 'img');
    if (!local || !/^[\w.-]+\.(png|txt)$/.test(name)) { res.writeHead(403); return res.end('ممنوع'); }
    fs.mkdirSync(dir, { recursive: true });
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks));
      res.writeHead(200); res.end('ok');
    });
    return;
  }

  /* أدوات التطوير: الكتاب نفسه بصيغة base64 نصّية (المتصفح بلا واجهة يُفرغ الاستجابات الثنائية) */
  if (u.startsWith('/__b64/')) {
    const fp = path.join(src, u.slice(6));
    if (!fp.startsWith(src) || !fs.existsSync(fp)) { res.writeHead(404); return res.end(); }
    b64Cache[fp] ||= fs.readFileSync(fp).toString('base64');
    const body = Buffer.from(b64Cache[fp], 'ascii');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=us-ascii', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
    return res.end(body);
  }

  let base = root;
  if (u.startsWith('/__src/')) { base = src; u = u.slice(6); }
  if (u === '/') u = '/index.html';
  const fp = path.join(base, u);
  if (!fp.startsWith(base) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('غير موجود'); }
  // ملفات /__src/ تُرسل كبيانات خام بطول معلوم ، حتى لا يعترضها عارض PDF المدمج في المتصفح
  const raw = base === src;
  res.writeHead(200, {
    'Content-Type': raw ? 'application/octet-stream' : (types[path.extname(fp)] || 'application/octet-stream'),
    'Content-Length': fs.statSync(fp).size,
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(fp).pipe(res);
}).listen(PORT, () => console.log('دفتر التحضير يعمل على  http://localhost:' + PORT));
