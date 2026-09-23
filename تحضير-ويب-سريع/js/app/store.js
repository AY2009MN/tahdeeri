/* ═══ التخزين الشخصي : ملفُّك أنت ، في مكانٍ تختاره ═══
   تختار ملفّاً مرّةً واحدة ـ في مجلّد OneDrive أو Drive أو ذاكرة USB أو أيّ
   مكان ـ فيحفظ التطبيق عمله فيه بنقرة ، ويستعيده منه في أيّ جهاز. والمزامنة
   بين أجهزتك تقع من نفسها إن كان المجلّد مزامَناً عندك ، فلا وسيط ولا رمز
   وصول ولا شيء يخرج إلى أحد.

   المتصفّحات التي لا تدعم اختيار الملفّات (سفاري والهاتف غالباً) تعود إلى
   التنزيل والاستيراد المعتادَين ، والنتيجة واحدة بخطوةٍ زائدة. */

const FS_OK = typeof window !== 'undefined' && 'showSaveFilePicker' in window;
const STORE_TYPES = [{ description: 'نسخة دفتر التحضير', accept: { 'application/json': ['.daftar', '.json'] } }];

const handleGet = async () => (await DB.get('handles', 'backup').catch(() => null))?.h || null;
const handleSet = h => DB.put('handles', { id: 'backup', h });

/** يتأكّد من إذن الكتابة/القراءة ـ يطلبه إن لزم (يحتاج نقرة المستخدم) */
async function handleOk(h, mode = 'readwrite') {
  if (!h) return false;
  if (!h.queryPermission) return true;     // مقبضٌ بلا أذونات (كمخزن المتصفّح) مأذونٌ أصلاً
  const q = await h.queryPermission({ mode });
  if (q === 'granted') return true;
  return (await h.requestPermission?.({ mode })) === 'granted';
}

/** اسم الملفّ المختار ، أو '' */
async function storeName() {
  const h = await handleGet();
  return h ? h.name : '';
}

/* ═══ الاختيار والحفظ والاستعادة ═══ */

async function storePick() {
  if (!FS_OK) return alert('متصفّحك لا يدعم اختيار ملفٍّ ثابت.\n\n' +
    'استعمل «نسخة احتياطية» للتنزيل و«استيراد نسخة» للاستعادة ـ النتيجة واحدة.');
  try {
    const h = await showSaveFilePicker({
      suggestedName: `دفتر_التحضير.daftar`, types: STORE_TYPES
    });
    await handleSet(h);
    await storeSave();
    renderStoreBox();
  } catch (e) { if (e.name !== 'AbortError') alert('تعذّر اختيار الملفّ: ' + e.message); }
}

/** يكتب كلّ عملك في ملفّك. silent: لا رسالة (للحفظ التلقائي) */
async function storeSave(silent) {
  const h = await handleGet();
  if (!h) { if (!silent) return storePick(); return false; }
  if (!await handleOk(h)) { if (!silent) alert('لم يُؤذن بالكتابة في الملفّ.'); return false; }
  try {
    const data = await DB.dump(false);                 // رمز الوصول منزوعٌ أصلاً
    const w = await h.createWritable();
    await w.write(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    await w.close();
    S.storeAt = new Date().toISOString();
    await DB.put('settings', S);
    renderStoreBox();
    if (!silent) toast(`حُفظ في «${h.name}» ✓`);
    return true;
  } catch (e) { if (!silent) alert('تعذّر الحفظ: ' + e.message); return false; }
}

/** يستعيد عملك من ملفّك ـ في هذا الجهاز أو في غيره */
async function storeLoad() {
  let h = await handleGet();
  if (!h) {
    if (!FS_OK) return byId('impFile')?.click();
    try { [h] = await showOpenFilePicker({ types: STORE_TYPES }); }
    catch (e) { return; }
    await handleSet(h);
  }
  if (!await handleOk(h, 'read')) return alert('لم يُؤذن بقراءة الملفّ.');
  let data;
  try { data = JSON.parse(await (await h.getFile()).text()); }
  catch { return alert(`تعذّرت قراءة «${h.name}».`); }
  if (data.app !== 'daftar-tahdeer') return alert(`«${h.name}» ليس ملفّ نسخة من دفتر التحضير.`);
  const when = (data.exportedAt || '').slice(0, 16).replace('T', ' ');
  if (!confirm(`استعادة من «${h.name}»${when ? ` (${when})` : ''} : ${ar((data.preps || []).length)} تحضيراً.\n\n` +
               'سيُستبدل كلّ ما على هذا الجهاز. متابعة؟')) return;
  await DB.restore(data);
  location.reload();
}

/** ينسى الملفّ ـ لا يحذفه */
async function storeForget() {
  if (!confirm('نسيان الملفّ المختار؟ (الملفّ نفسه يبقى في مكانه)')) return;
  await DB.del('handles', 'backup');
  delete S.storeAt; await DB.put('settings', S);
  renderStoreBox();
}

/* ═══ الحفظ التلقائي ═══
   يعمل بعد التعديل بمهلة ، لا مع كلّ حرف ـ فالكتابة على القرص ليست مجّانية. */
const storeSoon = debounce(() => { if (S.autoStore) storeSave(true); }, 15000);

async function toggleAutoStore(on) {
  S.autoStore = !!on;
  await DB.put('settings', S);
  if (on && !await handleGet()) await storePick();
  renderStoreBox();
}

/* ═══ العرض في الإعدادات ═══ */
async function renderStoreBox() {
  const box = byId('storeInfo'); if (!box) return;
  const name = await storeName();
  const when = S.storeAt ? new Date(S.storeAt).toLocaleString('ar-KW', { dateStyle: 'short', timeStyle: 'short' }) : '';
  box.innerHTML = name
    ? `ملفّك: <b>${esc(name)}</b>${when ? ` ـ آخر حفظ: ${esc(when)}` : ' ـ لم يُحفظ بعد'}`
    : (FS_OK ? 'لم تختر ملفّاً بعد.' : 'متصفّحك لا يدعم الملفّ الثابت ـ استعمل التنزيل والاستيراد.');
  const cb = byId('chkAutoStore'); if (cb) cb.checked = !!S.autoStore;
  byId('btnStoreForget')?.classList.toggle('hidden', !name);
}

function wireStore() {
  bind('btnStorePick', 'onclick', storePick);
  bind('btnStoreSave', 'onclick', () => storeSave());
  bind('btnStoreLoad', 'onclick', storeLoad);
  bind('btnStoreForget', 'onclick', storeForget);
  bind('chkAutoStore', 'onchange', e => toggleAutoStore(e.target.checked));
  renderStoreBox();
}
