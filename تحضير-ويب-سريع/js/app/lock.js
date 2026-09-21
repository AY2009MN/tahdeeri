/* ═══ قفل التعديل بالرقم السرّي ═══
   يمنع التعديل على هذا الجهاز حتى يُدخَل الرقم (١٩٨٥ ابتداءً ، ويمكن تغييره).
   يُحفظ مبصوماً بـ SHA-256 فلا يظهر الرقم نفسه في قاعدة البيانات.
   هو قفل محلّي ـ لا يحمي المستودع ، الذي يحميه رمز الوصول. */

const LOCK = { open: false };

const sha256 = async txt => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
};

/** يُطبَّق بعد كل رسم للورقة : المقفل يُقرأ ويُطبع ولا يُكتب فيه */
function lockApply() {
  document.body.classList.toggle('locked', !LOCK.open);
  $$('#paper [contenteditable]').forEach(el =>
    el.setAttribute('contenteditable', LOCK.open ? 'true' : 'false'));
  // صورةٌ محدَّدة وقت الإقفال يبقى شريطها معروضاً ـ نرفعه مع القفل
  if (!LOCK.open && typeof inlDeselect === 'function') inlDeselect();
  const b = byId('btnLock');
  if (b) {
    b.textContent = LOCK.open ? '🔓 مفتوح' : '🔒 مقفل';
    b.title = LOCK.open ? 'اقفل التعديل' : 'أدخل الرقم السرّي لفتح التعديل';
  }
  setText('lockState', LOCK.open
    ? 'التعديل مفتوح على هذا الجهاز.'
    : 'التعديل مقفل ـ أدخل الرقم السرّي لفتحه.');
}

async function lockToggle() {
  if (LOCK.open) { LOCK.open = false; return lockApply(); }
  const code = prompt('الرقم السرّي لفتح التعديل:');
  if (code === null) return;
  if (await sha256(code) !== S.lockHash) return alert('رقم غير صحيح.');
  LOCK.open = true;
  lockApply();
  toast('فُتح التعديل ✓');
}

async function lockChange() {
  const old = prompt('الرقم الحالي:');
  if (old === null) return;
  if (await sha256(old) !== S.lockHash) return alert('الرقم الحالي غير صحيح.');
  const neu = prompt('الرقم الجديد:');
  if (neu === null) return;
  if (!neu.trim()) return alert('لا يصحّ رقم فارغ.');
  if (neu !== prompt('أعد كتابة الرقم الجديد للتأكيد:')) return alert('الرقمان غير متطابقين.');
  S.lockHash = await sha256(neu);
  await DB.put('settings', S);
  LOCK.open = true;
  lockApply();
  alert('تغيّر الرقم السرّي.');
}

/** أوّل تشغيل : الرقم الابتدائي ١٩٨٥ */
async function initLock() {
  if (!S.lockHash) { S.lockHash = await sha256('1985'); await DB.put('settings', S); }
  LOCK.open = false;
  lockApply();
  bind('btnLock', 'onclick', lockToggle);
  bind('btnLockChange', 'onclick', lockChange);
}
