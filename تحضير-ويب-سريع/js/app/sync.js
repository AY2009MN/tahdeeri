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

/** المستودع العامّ يراه الناس ، والمزامنة ترفع التحضيرات وصور الكتاب.
    فلا يُرفع إليه إلّا بإقرار صريح ـ لا بسهو في خانة اسم المستودع. */
async function confirmPublic() {
  const info = await GH.info();
  if (!info || info.private) return true;
  return confirm(
    `تنبيه: المستودع «${GH.cfg.repo}» عامّ ـ يراه أيّ أحد على الإنترنت.\n\n` +
    'سيُنشر ما ترفعه : تحضيراتك وصور الكتاب المدرجة فيها.\n\n' +
    'موافق : ارفع على كلّ حال.\nإلغاء : أعود لأضع مستودعاً خاصّاً.');
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
