/* ═══ عميل GitHub ═══
   كل ما يتّصل بواجهة GitHub في موضع واحد : الإعداد ، الطلبات ، قراءة الملفّ
   وكتابته ، ونزع رمز الوصول قبل الرفع. أمّا متى نرفع ونجلب ـ ومن يأذن بذلك ـ
   ففي js/app/sync.js. */

/* مستودع واحد للتطبيق وبياناته : AY2009MN/tahdeeri ، وهو عامّ.
   كان للبيانات مستودعٌ ثانٍ خاصّ (tahdeeri-data) فحُذف ـ مستودعان لشيءٍ
   واحد تشتيتٌ بلا فائدة ، ولم يُستعمل الثاني قطّ. */
const DEFAULT_REPO = 'AY2009MN/tahdeeri';

const GH = {
  get cfg() {
    const g = S.gh || {};
    return { repo: g.repo || DEFAULT_REPO, branch: g.branch || 'main',
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

  /** بيانات المستودع ـ منها هل هو عامّ يراه الناس */
  async info() {
    const c = this.cfg;
    const r = await this.api(c.repo, c.token);
    return r.ok ? r.json() : null;
  },

  /** ٤٠٤ من واجهة المحتويات تحتمل معنيين : الملفّ لم يُرفع بعد ، أو المستودع
      نفسه لا يصل إليه الرمز ـ فـ GitHub يخفي وجود ما لا تملك رؤيته ويردّ ٤٠٤.
      الخلط بينهما يجعل «اجلب» يقول «لا توجد نسخة مرفوعة» وهي موجودة ،
      و«زامن» يفشل بـ ٤٠٤ مبهم. فنسأل المستودع نفسه لنميّز. */
  async assertRepo() {
    const c = this.cfg;
    const r = await this.api(c.repo, c.token);
    if (r.ok) return;
    if (r.status === 401) throw new Error('رمز الوصول غير صحيح أو انتهت صلاحيته.');
    if (r.status === 404) throw new Error(
      `تعذّر الوصول إلى المستودع «${c.repo}».\n\n` +
      'تأكّد من اسمه ، ومن أنّ رمز الوصول يشمله بصلاحية\n' +
      'Contents: Read and write.');
    throw new Error('تعذّر الوصول إلى المستودع: ' + r.status);
  },

  /** يقرأ الملف البعيد ـ يعيد {data, sha} أو {data:null} إن لم يكن موجوداً */
  async read() {
    const c = this.cfg;
    const r = await this.api(`${c.repo}/contents/${encodeURI(c.path)}?ref=${encodeURIComponent(c.branch)}`, c.token);
    if (r.status === 404) { await this.assertRepo(); return { data: null, sha: null }; }
    if (r.status === 401) throw new Error('رمز الوصول غير صحيح أو انتهت صلاحيته.');
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
    if (!r.ok) throw new Error(await writeError(r, c));
    return r.json();
  }
};

/** رسالة مفهومة لفشل الرفع ـ الرقم وحده لا يدلّ المعلّم على ما يفعل.
    ٤٠٣ خاصّةً هي الفخّ : القراءة تنجح (المستودعات العامّة يقرأها أيّ رمز
    صالح) ثمّ يفشل الرفع ، فيظنّ أنّ المزامنة تمّت. */
async function writeError(r, c) {
  const body = (await r.text()).slice(0, 200);
  const head = `تعذّر الرفع إلى «${c.repo}» (${r.status}).\n\n`;
  if (r.status === 403) return head +
    'الرمز لا يملك صلاحية الكتابة في هذا المستودع.\n' +
    'تأكّد أنّ صلاحيته Contents: Read and write ، وأنّه يشمل هذا المستودع بعينه.';
  if (r.status === 404) return head +
    'المستودع أو الفرع غير موجود ، أو الرمز لا يصل إليه.\n' +
    `تأكّد من اسم المستودع ومن أنّ الفرع «${c.branch}» موجود.`;
  if (r.status === 409 || r.status === 422) return head +
    'النسخة في المستودع تغيّرت من جهاز آخر.\n' +
    'أعِد المحاولة ـ وإن تكرّر فاجلب أوّلاً ثمّ ارفع.';
  if (r.status === 401) return 'رمز الوصول غير صحيح أو انتهت صلاحيته.';
  return head + body;
}

/** ينزع رمز الوصول من البيانات قبل رفعها ـ لا يُرفع الرمز أبداً */
function stripToken(dump) {
  const out = JSON.parse(JSON.stringify(dump));
  (out.settings || []).forEach(s => { if (s.gh) delete s.gh.token; });
  return out;
}

/* ═══ المزامنة : متى نرفع ونجلب ، ومن يأذن ═══
   (واجهة GitHub نفسها في js/app/github.js) */

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

/** ═══ بوّابة المزامنة ═══
    لا يخرج تعديل إلى الإنترنت ولا يُستبدل جهاز إلّا بالرقم السرّي ، يُسأل عنه
    في كلّ مرّة. لا يكفي أن يكون قفل التحرير مفتوحاً : فتحه مرّة للكتابة كان
    يبيح الرفع بعدها بلا سؤال. الرقم هو رقم القفل نفسه (١٩٨٥ ابتداءً) ، يُغيَّر
    من «تغيير الرقم السرّي» في الإعدادات ، ويُحفظ مبصوماً لا نصّاً. */
async function askSecret(action) {
  const code = prompt(`الرقم السرّي ${action} :`);
  if (code === null) return false;
  if (await sha256(code) !== S.lockHash) { alert('رقم غير صحيح ـ أُلغيت العملية.'); return false; }
  return true;
}

/** المستودع العامّ يراه الناس. يُستأذن مرّةً واحدة لكلّ مستودع ، ويُحفظ
    الإقرار ـ فلا يُسأل المعلّم في كلّ رفع عمّا اختاره أصلاً. */
async function confirmPublic() {
  const info = await GH.info();
  if (!info || info.private) return true;
  if ((S.gh || {}).publicOk === GH.cfg.repo) return true;
  const ok = confirm(
    `المستودع «${GH.cfg.repo}» عامّ ـ يراه أيّ أحد على الإنترنت.\n\n` +
    'سيُنشر ما ترفعه : تحضيراتك وصور الكتاب المدرجة فيها.\n\n' +
    'موافق : ارفع ، ولا أسألك عن هذا المستودع مرّةً أخرى.\nإلغاء : لا ترفع.');
  if (ok) { S.gh = { ...(S.gh || {}), publicOk: GH.cfg.repo }; await DB.put('settings', S); }
  return ok;
}

async function syncPush() {
  if (!GH.cfg.token) return alert('أدخل رمز الوصول أوّلاً في خانة «رمز الوصول».');
  if (!await askSecret('لرفع تعديلاتك إلى GitHub')) return;
  try {
    syncMsg('جارٍ التجهيز…');
    if (!await confirmPublic()) return syncMsg('');
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
    // الجلب يمحو عمل هذا الجهاز ، فيُسأل عن الرقم كما يُسأل عند الرفع
    if (!await askSecret('لاستبدال ما على هذا الجهاز')) return syncMsg('');
    const keepToken = (S.gh || {}).token;               // الرمز محلّي ـ لا يأتي من المستودع
    await DB.restore(data);
    S = (await DB.get('settings', 'app')) || S;
    S.gh = { ...(S.gh || {}), token: keepToken };
    await DB.put('settings', S);
    location.reload();
  } catch (e) { syncMsg(''); alert(e.message); }
}

function wireSync() {
  // جهازٌ أُعدّ على المستودع المحذوف يُحوَّل إلى الواحد الباقي
  if ((S.gh || {}).repo === 'AY2009MN/tahdeeri-data') {
    S.gh = { ...S.gh, repo: DEFAULT_REPO };
    DB.put('settings', S);
  }
  const g = S.gh || {};
  setVal('ghRepo', g.repo || DEFAULT_REPO);
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

/* ═══ نسخة احتياطية بضغطة واحدة ═══
   زرّ واحد يفعل الواجب كلّه :
     ١ ـ يسأل الرقم السرّي.
     ٢ ـ ينزّل ملفّ النقل على الجهاز  ـ يعمل دائماً ، بلا حساب ولا إنترنت.
     ٣ ـ ثمّ يرفعه إلى GitHub إن كان رمز الوصول مضبوطاً.

   الترتيب مقصود : الملفّ أوّلاً. فهو وحده يكفي للنقل والاسترجاع ، ولا يتوقّف
   على شيء. والرفع زيادةٌ لمن أعدّ الرمز ، فإن لم يُعدَّ لم تُعدّ النسخة ناقصة
   ولم يُزعج المعلّم بخطأ ـ بل يُخبَر أنّ الملفّ نزل وكفى. */

/** يبني حمولة النسخة مرّة واحدة ـ تُستعمل للملفّ وللرفع معاً */
async function backupPayload() {
  const dump = stripToken(await DB.dump(false));   // بلا كتب PDF ـ حجمها كبير
  dump.syncedAt = new Date().toISOString();
  dump.device = navigator.userAgent.slice(0, 60);
  return dump;
}

/** ينزّل الحمولة ملفّاً باسم فيه التاريخ والوقت */
function downloadBackup(dump) {
  const now = new Date();
  const hm = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(dump)], { type: 'application/json' }));
  a.download = `دفتر_التحضير_${iso(now)}_${hm}.daftar`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** يرفع إلى GitHub ـ يعيد نصّ النتيجة ، ولا يرمي فيُسقط النسخة المحفوظة */
async function backupPush(dump) {
  if (!GH.cfg.token) return 'الملفّ نزل. (لم يُرفع إلى GitHub ـ لم يُضبط رمز الوصول بعد)';
  try {
    if (!await confirmPublic()) return 'الملفّ نزل. (أُلغي الرفع)';
    syncMsg('جارٍ الرفع إلى GitHub…');
    const { sha } = await GH.read();
    await GH.write(dump, sha, 'نسخة احتياطية ' + todayISO());
    S.lastSync = dump.syncedAt;
    await DB.put('settings', S);
    return 'الملفّ نزل ، ورُفع إلى GitHub ✓';
  } catch (e) {
    alert('نزل الملفّ على جهازك ، لكن تعذّر الرفع إلى GitHub:\n\n' + e.message);
    return 'الملفّ نزل ـ وتعذّر الرفع.';
  }
}

async function backupNow() {
  if (!await askSecret('لأخذ نسخة احتياطية')) return;
  try {
    syncMsg('جارٍ تجهيز النسخة…');
    const dump = await backupPayload();
    const mb = new Blob([JSON.stringify(dump)]).size / 1048576;
    downloadBackup(dump);
    const msg = await backupPush(dump);
    syncMsg(`${msg} ـ الحجم ${ar(mb.toFixed(1))} ميجابايت`);
    toast(msg);
    unsaved = 0;
  } catch (e) { syncMsg(''); alert('تعذّر أخذ النسخة: ' + e.message); }
}

function wireBackup() {
  bind('btnBackup', 'onclick', backupNow);
  bind('btnBackupBar', 'onclick', backupNow);
}
