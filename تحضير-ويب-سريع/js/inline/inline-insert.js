/* ═══ هدف الإدراج وتنفيذه ═══
   الهدف إمّا «موضع إدراج جاهز» نُقر عليه ، أو موضع المؤشّر داخل أحد الصناديق.
   يُتذكَّر الموضع حتى بعد فتح الاستوديو ، فتعود اللقطة إلى مكانها الصحيح. */

document.addEventListener('selectionchange', () => {
  const sel = document.getSelection();
  if (!sel || !sel.rangeCount) return;
  const n = sel.anchorNode;
  const el = n && (n.nodeType === 1 ? n : n.parentElement);
  const box = el && el.closest('#paper .sectbox[contenteditable]');
  if (box) { INL.range = sel.getRangeAt(0).cloneRange(); INL.box = box; INL.slot = null; }
});

/** هل يوجد هدف إدراج صالح في الورقة الحالية؟ */
const inlTarget = () =>
  (INL.slot && document.contains(INL.slot)) || (INL.box && document.contains(INL.box));

function inlTargetName() {
  if (INL.slot && document.contains(INL.slot)) return `مكان «${INL.slot.dataset.label}»`;
  if (!INL.box || !document.contains(INL.box)) return '';
  // عنوان القسم بلا أزرار ضبط الأسطر التي تسكن داخله
  const ttl = INL.box.closest('.sect')?.querySelector('.secttl')?.cloneNode(true);
  ttl?.querySelector('.hctl')?.remove();
  return `موضع المؤشّر في «${(ttl?.textContent || '').trim()}»`;
}

/** يجعل صندوقاً بعينه هدف الإدراج (يُستعمل من قائمة الاستوديو) */
function inlSetTarget(field) {
  const box = $(`#paper .sectbox[data-f="${field}"]`);
  if (!box) return false;
  INL.box = box; INL.slot = null;
  const r = document.createRange();
  r.selectNodeContents(box); r.collapse(false);
  INL.range = r;
  return true;
}

/** العرض المناسب للصورة بحسب نسبتها ـ الطويلة أضيق لتبقى الورقة متّسقة */
function inlWidthFor(ratio) {
  return ratio > 0.9 ? 55 : ratio > 0.5 ? 75 : 92;
}

/** يضع صفّ الصورة في مكان «موضع الإدراج» ويحوّله إلى عنوان */
function placeAtSlot(row) {
  const box = INL.slot.closest('.sectbox');
  const label = document.createElement('b');
  label.className = 'inllbl';
  label.textContent = INL.slot.dataset.label;
  const line = INL.slot.closest('.sectbox > div') || INL.slot;
  INL.slot.replaceWith(label);
  line.after(row);
  INL.slot = null;
  return box;
}

/** يضع صفّ الصورة عند مؤشّر الكتابة */
function placeAtCursor(row) {
  const box = INL.box;
  let line = INL.range ? INL.range.startContainer : null;
  while (line && line.parentNode !== box) line = line.parentNode;
  if (line) line.after(row); else box.appendChild(row);
  const r = document.createRange();
  r.setStartAfter(row); r.collapse(true);
  INL.range = r;
  return box;
}

/** إدراج صورة في الهدف المحفوظ. يعيد false إن لم يوجد هدف. */
async function insertInline(dataUrl, { w } = {}) {
  if (!inlTarget()) return false;
  const id = await putAsset(dataUrl);
  const probe = await loadImage(dataUrl).catch(() => null);
  const ratio = probe ? probe.naturalHeight / probe.naturalWidth : 0.6;

  const row = document.createElement('div');
  row.className = 'inlrow';
  row.innerHTML = inlSpan({ asset: id, w: w || inlWidthFor(ratio) });

  const box = (INL.slot && document.contains(INL.slot)) ? placeAtSlot(row) : placeAtCursor(row);
  await hydrateAssets(row);
  box.dispatchEvent(new Event('input', { bubbles: true }));
  setTimeout(fitSheets, 60);
  row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return true;
}

/** يحفظ التعديل على صورة ويعيد فحص الامتلاء */
function inlSave(el) {
  const box = el && el.closest('.sectbox');
  if (box) box.dispatchEvent(new Event('input', { bubbles: true }));
  setTimeout(fitSheets, 30);
}
