/* =====================================================================
   قفل التعديل بالرقم السرّي + المزامنة مع GitHub

   القفل  : يمنع التعديل على هذا الجهاز حتى يُدخَل الرقم (١٩٨٥ ابتداءً ، ويمكن تغييره).
            يُحفظ مبصوماً بـ SHA-256 ، فلا يظهر الرقم نفسه في قاعدة البيانات.
            هو قفل محلّي على الجهاز ـ لا يحمي المستودع نفسه ، الذي يحميه رمز الوصول.

   المزامنة: ترفع بياناتك (التحضيرات واللقطات والإعدادات) ملفاً واحداً في المستودع ،
            وتجلبها في أيّ جهاز آخر. تحتاج رمز وصول شخصياً من GitHub بصلاحية contents.
            الرمز يبقى على جهازك وحده ولا يُرفع أبداً ـ يُنزع من البيانات قبل الرفع.
   ===================================================================== */

const LOCK = { open: false };

const sha256 = async txt => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
};

/** يُطبَّق بعد كل رسم للورقة: المقفل يُقرأ ويُطبع ولا يُكتب فيه */
function lockApply() {
  document.body.classList.toggle('locked', !LOCK.open);
  document.querySelectorAll('#paper [contenteditable]').forEach(el =>
    el.setAttribute('contenteditable', LOCK.open ? 'true' : 'false'));
  const b = document.getElementById('btnLock');
  if (b) {
    b.textContent = LOCK.open ? '🔓 مفتوح' : '🔒 مقفل';
    b.title = LOCK.open ? 'اقفل التعديل' : 'أدخل الرقم السرّي لفتح التعديل';
  }
  const st = document.getElementById('lockState');
  if (st) st.textContent = LOCK.open ? 'التعديل مفتوح على هذا الجهاز.' : 'التعديل مقفل ـ أدخل الرقم السرّي لفتحه.';
}

async function lockToggle() {
  if (LOCK.open) { LOCK.open = false; lockApply(); return; }
  const code = prompt('الرقم السرّي لفتح التعديل:');
  if (code === null) return;
  if (await sha256(code) !== S.lockHash) { alert('رقم غير صحيح.'); return; }
  LOCK.open = true; lockApply();
}

async function lockChange() {
  const old = prompt('الرقم الحالي:');
  if (old === null) return;
  if (await sha256(old) !== S.lockHash) { alert('الرقم الحالي غير صحيح.'); return; }
  const neu = prompt('الرقم الجديد:');
  if (neu === null) return;
  if (!neu.trim()) { alert('لا يصحّ رقم فارغ.'); return; }
  if (neu !== prompt('أعد كتابة الرقم الجديد للتأكيد:')) { alert('الرقمان غير متطابقين.'); return; }
  S.lockHash = await sha256(neu);
  await DB.put('settings', S);
  LOCK.open = true; lockApply();
  alert('تغيّر الرقم السرّي.');
}

/* ────────── المزامنة مع GitHub ────────── */
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
  /** يقرأ الملف البعيد ـ يعيد {data, sha} أو {data:null} إن لم يكن موجوداً */
  async read() {
    const c = this.cfg;
    const r = await this.api(`${c.repo}/contents/${encodeURI(c.path)}?ref=${encodeURIComponent(c.branch)}`, c.token);
    if (r.status === 404) return { data: null, sha: null };
    if (!r.ok) throw new Error('تعذّر القراءة: ' + r.status + ' ' + (await r.text()).slice(0, 120));
    const j = await r.json();
    const bin = atob(j.content.replace(/\n/g, ''));
    const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    return { data: JSON.parse(new TextDecoder().decode(bytes)), sha: j.sha };
  },
  async write(obj, sha, msg) {
    const c = this.cfg;
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
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

const syncMsg = t => { const e = document.getElementById('syncMsg'); if (e) e.textContent = t; };

async function syncPush() {
  if (!GH.cfg.token) { alert('أدخل رمز الوصول أوّلاً في خانة «رمز الوصول».'); return; }
  if (!LOCK.open) { alert('افتح القفل بالرقم السرّي قبل الرفع.'); return; }
  try {
    syncMsg('جارٍ الرفع…');
    const { sha } = await GH.read();
    const dump = stripToken(await DB.dump(false));      // بلا كتب PDF ـ حجمها كبير
    dump.syncedAt = new Date().toISOString();
    dump.device = navigator.userAgent.slice(0, 60);
    await GH.write(dump, sha, 'مزامنة دفتر التحضير ' + iso(new Date()));
    S.lastSync = dump.syncedAt; await DB.put('settings', S);
    syncMsg('تمّ الرفع ـ آخر مزامنة ' + dump.syncedAt.slice(0, 16).replace('T', ' '));
  } catch (e) { syncMsg(''); alert(e.message); }
}

async function syncPull() {
  if (!GH.cfg.token) { alert('أدخل رمز الوصول أوّلاً في خانة «رمز الوصول».'); return; }
  try {
    syncMsg('جارٍ الجلب…');
    const { data } = await GH.read();
    if (!data) { syncMsg(''); alert('لا توجد نسخة مرفوعة بعد.'); return; }
    const when = (data.syncedAt || '').slice(0, 16).replace('T', ' ');
    if (!confirm(`سيستبدل هذا كلّ ما على هذا الجهاز بالنسخة المرفوعة (${when}). أتريد المتابعة؟`)) { syncMsg(''); return; }
    const keepToken = (S.gh || {}).token;               // الرمز محلّي ـ لا يأتي من المستودع
    await DB.restore(data);
    S = (await DB.get('settings', 'app')) || S;
    S.gh = { ...(S.gh || {}), token: keepToken };
    await DB.put('settings', S);
    syncMsg('تمّ الجلب ـ أعِد تحميل الصفحة.');
    location.reload();
  } catch (e) { syncMsg(''); alert(e.message); }
}

/* ────────── ربط الواجهة ────────── */
async function wireSync() {
  /* أوّل تشغيل: الرقم الابتدائي ١٩٨٥ */
  if (!S.lockHash) { S.lockHash = await sha256('1985'); await DB.put('settings', S); }
  LOCK.open = false;
  lockApply();

  const g = S.gh || {};
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || ''; };
  set('ghRepo', g.repo || 'AY2009MN/tahdeeri');
  set('ghBranch', g.branch || 'main');
  set('ghPath', g.path || 'بيانات/daftar-data.json');
  set('ghToken', g.token);
  if (S.lastSync) syncMsg('آخر مزامنة ' + S.lastSync.slice(0, 16).replace('T', ' '));

  ['ghRepo', 'ghBranch', 'ghPath', 'ghToken'].forEach(id => {
    const e = document.getElementById(id); if (!e) return;
    e.onchange = () => {
      S.gh = { ...(S.gh || {}), [id.replace('gh', '').toLowerCase()]: e.value.trim() };
      DB.put('settings', S);
    };
  });

  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('btnLock', lockToggle);
  on('btnLockChange', lockChange);
  on('btnSyncPush', syncPush);
  on('btnSyncPull', syncPull);
}
