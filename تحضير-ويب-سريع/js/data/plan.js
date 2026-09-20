/* ═══ تسطيح المنهج إلى قائمة حصص ═══
   يحوّل شجرة «وحدة ← درس ← حصة» إلى قائمة مسطّحة ، كلّ عنصر فيها يحمل
   ما تحتاجه ورقة التحضير كاملاً : بيانات الدرس ، محتوى الحصة ، وصورها. */

function flattenSession(gid, cur, u, l, s, i, n) {
  return {
    id: `${gid}|${n}`, n,
    gradeId: gid, gradeName: cur.name, section: cur.section,
    unitNo: u.no, unitTitle: u.title,
    // المعيار ومؤشّر الأداء من جدول الدليل : للدرس إن وُجد ، وإلّا فمن الوحدة
    standard: l.standard || u.standard, indicators: l.indicators || u.indicators,
    code: l.code, title: l.title, pages: l.pages, outcomes: l.outcomes,
    vocab: l.vocab, media: l.media || [],
    partIdx: i + 1, partOf: l.sessions.length,
    focus: s.focus,
    intro: u.ready ? s.intro : slotify(s.intro),
    show: u.ready ? s.show : slotify(s.show),
    show2: u.ready ? (s.show2 || '') : slotify(s.show2 || ''),
    close: s.close, evalx: s.evalx,
    worksheet: s.worksheet || null, figs: s.figs || [],
    ready: !!u.ready            // حصة جاهزة ضمن المنهج تُعدّ محضَّرة
  };
}

function flatten(gid) {
  const cur = CURRICULA[gid], out = [];
  cur.units.forEach(u => u.lessons.forEach(l => l.sessions.forEach((s, i) => {
    out.push(flattenSession(gid, cur, u, l, s, i, out.length));
  })));
  return out;
}

/** كل دروس الصف في قائمة واحدة ـ تُستعمل في الاستوديو وقوائم الاختيار */
function lessonsOf(gid) {
  const out = [];
  (CURRICULA[gid] || CURRICULA[grade]).units.forEach(u =>
    u.lessons.forEach(l => out.push({ ...l, unitNo: u.no, unitTitle: u.title })));
  return out;
}

/** أوّل حصة تطابق شرطاً (وحدة أو درساً) ـ تُستعمل في قوائم المحرّر */
function firstSessionWhere(pred) {
  const i = sessions().findIndex(pred);
  return i < 0 ? curIdx : i;
}
