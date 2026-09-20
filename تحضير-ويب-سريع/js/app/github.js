/* ═══ عميل GitHub ═══
   كل ما يتّصل بواجهة GitHub في موضع واحد : الإعداد ، الطلبات ، قراءة الملفّ
   وكتابته ، ونزع رمز الوصول قبل الرفع. أمّا متى نرفع ونجلب ـ ومن يأذن بذلك ـ
   ففي js/app/sync.js. */

const DEFAULT_REPO = 'AY2009MN/tahdeeri-data';

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
