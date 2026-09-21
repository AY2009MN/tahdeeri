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
