/* ═══ توزيع «العرض» على صفحتَي القالب ═══
   يُملأ صندوق الصفحة الأولى سطراً سطراً حتى يبلغ حدّه ، ويُنقل الباقي إلى
   «تابع العرض» في الصفحة الثانية ، فلا تبقى الصفحة الثانية فارغة.

   القياس يجري دائماً في نسخة خفيّة بمقاس A4 الحقيقي (#printArea) ، لا في
   الورقة المعروضة ، حتى يبقى التوزيع مطابقاً للطباعة في كلّ الأوضاع ـ
   وهذا ما يجعل التحرير على الهاتف لا يفسد ترقيم الصفحات. */

/** يبني صندوق قياس بمقاس A4 ويعيد {box, wrap, done} ـ done تُزيل النسخة */
function measureBox(s) {
  const host = byId('printArea');
  host.innerHTML = sheetHTML(s);
  const box = host.querySelector('.sectbox[data-f="show"]');
  const wrap = box && (box.closest('.sectwrap') || box.parentElement);
  return { box, wrap, done: () => { host.innerHTML = ''; } };
}

/** المساحة المتاحة للنصّ = ارتفاع الصندوق ناقص ارتفاع الصور التي تشاركه الإطار */
function textRoom(wrap) {
  const figsH = $$('.figs', wrap)
    .filter(x => getComputedStyle(x).position !== 'absolute')
    .reduce((a, x) => a + x.offsetHeight, 0);
  return Math.max(40, wrap.clientHeight - figsH - 8);
}

function flowShow(s) {
  const b1 = $('#paper .sectbox[data-f="show"]');
  const b2 = $('#paper .sectbox[data-f="show2"]');
  if (!b1 || !b2) return;

  const p = prepOf(s);
  if (p.show2 !== undefined && p.show2 !== '') return;  // كتب المعلّم في الصفحة الثانية ـ لا نلمسها
  if (s.show2) return;                                  // الدرس يوزّع محتواه بنفسه

  const text = String((p.show !== undefined && p.show !== '') ? p.show : (s.show || ''));
  const lines = text.split('\n');
  if (lines.length < 2) { b1.innerHTML = renderRich(text); b2.innerHTML = ''; return; }

  const m = measureBox(s);
  if (!m.wrap || m.wrap.clientHeight < 60) {            // تعذّر القياس ـ لا نقسّم
    m.done();
    b1.innerHTML = renderRich(text); b2.innerHTML = '';
    return;
  }

  // تُملأ الصفحة الأولى حتى ٦٢٪ من المساحة ، ليبقى لـ«تابع العرض» نصيب حقيقي دائماً
  const target = textRoom(m.wrap) * 0.62;
  const fit = [];
  for (const line of lines) {
    fit.push(line);
    m.box.innerHTML = renderRich(fit.join('\n'));
    if (m.box.scrollHeight > target) break;             // آخر سطر يتجاوز الحدّ يبقى في الأولى
  }
  if (fit.length === lines.length && lines.length > 2) fit.pop();   // اضمن سطراً للصفحة الثانية
  m.done();

  b1.innerHTML = renderRich(fit.join('\n'));
  b2.innerHTML = renderRich(lines.slice(fit.length).join('\n'));
}
