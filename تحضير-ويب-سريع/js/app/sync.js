/* ═══ المزامنة مع GitHub ═══
   ترفع بياناتك (التحضيرات واللقطات والإعدادات) ملفاً واحداً في المستودع ،
   وتجلبها في أيّ جهاز آخر. تحتاج رمز وصول شخصياً بصلاحية contents.
   الرمز يبقى على جهازك وحده ولا يُرفع أبداً ـ يُنزع من البيانات قبل الرفع. */

const GH = {
  get cfg() {
    const g = S.gh || {};
    return { repo: g.repo || 'AY2009MN/tahdeeri', branch: g.branch || 'main',
             path: g.path || 'بيانات/daftar-data.json', token: g.token || '' };
  },
  api(path, token, opts = {}) {
    return fetch('https://api.github.com/repos/' + path, {
      ...opts,
      headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token,
                 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) }
    });
  },
  /** ملفّ فوق ميجابايت واحد تعيده واجهة «المحتويات» بلا محتوى
      (encoding: none) ، فيُجلب من مخزن الكائنات الذي يتّسع حتى ١٠٠ ميجابايت.
      لولا ذلك لتعطّلت المزامنة كلّها بمجرّد تجاوز البيانات ميجابايت واحداً. */
  async blob(sha) {
    const c = this.cfg;
    const r = await this.api(`${c.repo}/git/blobs/${sha}`, c.token,
      { headers: { Accept: 'application/vnd.github.raw' } });
    if (!r.ok) throw new Error('تعذّر جلب البيانات الكبيرة: ' + r.status);
    return r.text();
  },

  /** يقرأ الملف البعيد ـ يعيد {data, sha} أو {data:null} إن لم يكن موجوداً */
  async read() {
    const c = this.cfg;
    const r = await this.api(`${c.repo}/contents/${encodeURI(c.path)}?ref=${encodeURIComponent(c.branch)}`, c.token);
    if (r.status === 404) return { data: null, sha: null };
    if (!r.ok) throw new Error('تعذّر القراءة: ' + r.status + ' ' + (await r.text()).slice(0, 120));
    const j = await r.json();
    const text = j.encoding === 'base64'
      ? new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\n/g, '')), ch => ch.charCodeAt(0)))
      : await this.blob(j.sha);
    try { return { data: JSON.parse(text), sha: j.sha }; }
    catch { throw new Error('ملف البيانات في المستودع غير صالح ـ لعلّه عُدّل أو رُفع بغير هذا التطبيق.'); }
  },
  async write(obj, sha, msg) {
    const c = this.cfg;
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    const r = await this.api(`${c.repo}/contents/${encodeURI(c.path)}`, c.token, {
      method: 'PUT',
      body: JSON.stringify({ message: msg, content: btoa(bin), branch: c.branch, ...(sha ? { sha } : {}) })
    });
    if (!r.ok) throw new Error('تعذّر الرفع: ' + r.status + ' ' + (await r.text()).slice(0, 160));
    return r.json();
  }
};

/** ينزع رمز الوصول من البيانات قبل رفعها ـ لا يُرفع الرمز أبداً */
function stripToken(dump) {
  const out = JSON.parse(JSON.stringify(dump));
  (out.settings || []).forEach(s => { if (s.gh) delete s.gh.token; });
  return out;
}

const syncMsg = t => setText('syncMsg', t);

const MB = 1048576;

/** اللقطات تُخزَّن داخل البيانات ، فيكبر الملف بسرعة. نُعلم المعلّم بالحجم
    قبل الرفع ـ فقد يكون على بيانات الهاتف ، وقد يقترب من حدود المستودع. */
function confirmSize(bytes) {
  const mb = bytes / MB;
  if (mb < 5) return true;
  return confirm(
    `حجم ما سيُرفع ${ar(mb.toFixed(1))} ميجابايت (أكثره صور الكتاب المدرجة).\n` +
    (mb > 60 ? 'وهذا قريب من حدّ المستودع ، وقد يفشل الرفع.\n' : '') +
    'إن كنت على بيانات الهاتف فقد يستهلك ذلك رصيدك.\n\nأتريد المتابعة؟');
}

async function syncPush() {
  if (!GH.cfg.token) return alert('أدخل رمز الوصول أوّلاً في خانة «رمز الوصول».');
  if (!LOCK.open) return alert('افتح القفل بالرقم السرّي قبل الرفع.');
  try {
    syncMsg('جارٍ التجهيز…');
    const dump = stripToken(await DB.dump(false));      // بلا كتب PDF ـ حجمها كبير
    dump.syncedAt = new Date().toISOString();
    dump.device = navigator.userAgent.slice(0, 60);
    if (!confirmSize(new Blob([JSON.stringify(dump)]).size)) return syncMsg('');
    syncMsg('جارٍ الرفع…');
    const { sha } = await GH.read();
    await GH.write(dump, sha, 'مزامنة دفتر التحضير ' + todayISO());
    S.lastSync = dump.syncedAt;
    await DB.put('settings', S);
    syncMsg('تمّ الرفع ـ آخر مزامنة ' + dump.syncedAt.slice(0, 16).replace('T', ' '));
  } catch (e) { syncMsg(''); alert(e.message); }
}

async function syncPull() {
  if (!GH.cfg.token) return alert('أدخل رمز الوصول أوّلاً في خانة «رمز الوصول».');
  try {
    syncMsg('جارٍ الجلب…');
    const { data } = await GH.read();
    if (!data) { syncMsg(''); return alert('لا توجد نسخة مرفوعة بعد.'); }
    const when = (data.syncedAt || '').slice(0, 16).replace('T', ' ');
    if (!confirm(`سيستبدل هذا كلّ ما على هذا الجهاز بالنسخة المرفوعة (${when}). أتريد المتابعة؟`)) {
      return syncMsg('');
    }
    const keepToken = (S.gh || {}).token;               // الرمز محلّي ـ لا يأتي من المستودع
    await DB.restore(data);
    S = (await DB.get('settings', 'app')) || S;
    S.gh = { ...(S.gh || {}), token: keepToken };
    await DB.put('settings', S);
    location.reload();
  } catch (e) { syncMsg(''); alert(e.message); }
}

function wireSync() {
  const g = S.gh || {};
  setVal('ghRepo', g.repo || 'AY2009MN/tahdeeri');
  setVal('ghBranch', g.branch || 'main');
  setVal('ghPath', g.path || 'بيانات/daftar-data.json');
  setVal('ghToken', g.token);
  if (S.lastSync) syncMsg('آخر مزامنة ' + S.lastSync.slice(0, 16).replace('T', ' '));

  ['ghRepo', 'ghBranch', 'ghPath', 'ghToken'].forEach(id => {
    bind(id, 'onchange', e => {
      S.gh = { ...(S.gh || {}), [id.replace('gh', '').toLowerCase()]: e.target.value.trim() };
      DB.put('settings', S);
    });
  });
  bind('btnSyncPush', 'onclick', syncPush);
  bind('btnSyncPull', 'onclick', syncPull);
}
