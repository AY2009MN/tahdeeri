/* =====================================================================
   المزامنة التلقائية مع OneDrive
   ــ الربط : تسجيل دخول Microsoft (OAuth 2.0 مع PKCE ، بلا خادم وسيط).
      الصلاحية الوحيدة : Files.ReadWrite.AppFolder ـ أي مجلد التطبيق وحده
      داخل OneDrive (Apps/<اسم التسجيل>) ، ولا يرى التطبيق بقية ملفاتك.
   ــ الملفات في مجلد التطبيق :
        daftar.json        الإعدادات والحصص والتحضيرات والتعديلات + فهرس اللقطات
        assets/<id>.txt    كل لقطة مدرجة في ملف مستقل (تُرفع مرة واحدة)
   ــ الدمج : لكل سجل وقت تعديل ts ، والأحدث يفوز سجلاً سجلاً ؛
      فتعديل حصة على التاب وأخرى على الحاسوب يجتمعان دون أن يمحو أحدهما الآخر.
   ــ التوقيت : عند فتح التطبيق ، وبعد ٨ ثوانٍ من آخر تعديل ، وكل دقيقتين ،
      وعند العودة إلى التطبيق. كتب PDF لا تُزامَن (كبيرة) ـ تُضاف على كل جهاز.
   ===================================================================== */

const Sync = (() => {
  const AUTH = 'https://login.microsoftonline.com/common/oauth2/v2.0';
  const GRAPH = 'https://graph.microsoft.com/v1.0/me/drive/special/approot';
  const SCOPE = 'Files.ReadWrite.AppFolder offline_access User.Read';
  const STORES = ['settings', 'sessions', 'preps', 'overrides'];
  const LS = k => 'daftar_sync_' + k;
  const ls = {
    get: k => { try { return localStorage.getItem(LS(k)); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(LS(k)) : localStorage.setItem(LS(k), v); } catch {} }
  };

  let token = null, tokenExp = 0, busy = false, timer = null, again = false;
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');
  const clientId = () => ls.get('client') || window.DAFTAR_CLIENT_ID || '';
  const linked = () => !!ls.get('refresh');

  /* ────────── الحالة في الواجهة ────────── */
  function status(text, kind) {
    ls.set('last_msg', text);
    const el = document.getElementById('syncState');
    if (el) { el.textContent = text; el.className = 'syncstate ' + (kind || ''); }
    const dot = document.getElementById('syncDot');
    if (dot) { dot.className = 'syncdot ' + (kind || ''); dot.title = text; dot.hidden = !linked(); }
  }

  /* ────────── PKCE ────────── */
  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const randomStr = n => b64url(crypto.getRandomValues(new Uint8Array(n)));
  const sha256 = async s => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

  async function login(silent) {
    const id = clientId();
    if (!id) { alert('أدخل «معرّف التطبيق (Client ID)» أولاً ـ انظر الخطوات في دليل الاستخدام.'); return; }
    const verifier = randomStr(48), state = randomStr(16);
    ls.set('verifier', verifier); ls.set('state', state);
    const q = new URLSearchParams({
      client_id: id, response_type: 'code', redirect_uri: redirectUri(), scope: SCOPE,
      code_challenge: await sha256(verifier), code_challenge_method: 'S256', state,
      response_mode: 'query'
    });
    if (silent) q.set('prompt', 'none');
    location.assign(`${AUTH}/authorize?${q}`);
  }

  async function tokenRequest(params) {
    const r = await fetch(`${AUTH}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId(), scope: SCOPE, redirect_uri: redirectUri(), ...params })
    });
    const j = await r.json();
    if (!r.ok) throw Object.assign(new Error(j.error_description || j.error || 'token'), { code: j.error });
    token = j.access_token; tokenExp = Date.now() + (j.expires_in - 120) * 1000;
    if (j.refresh_token) ls.set('refresh', j.refresh_token);
    return token;
  }

  /** العودة من صفحة Microsoft : ?code=…&state=… */
  async function handleRedirect() {
    const q = new URLSearchParams(location.search);
    if (!q.has('code') && !q.has('error')) return false;
    history.replaceState(null, '', redirectUri() + location.hash);
    if (q.get('state') !== ls.get('state')) return true;
    if (q.has('error')) {
      // prompt=none فشل لأن الجلسة انتهت ـ نطلب الدخول مرّة أخرى
      if (q.get('error') === 'login_required' || q.get('error') === 'interaction_required') { ls.set('refresh', null); status('انتهت جلسة الربط ـ اضغط «ربط الحساب»', 'err'); }
      else status('تعذّر الربط: ' + (q.get('error_description') || q.get('error')), 'err');
      return true;
    }
    try {
      await tokenRequest({ grant_type: 'authorization_code', code: q.get('code'), code_verifier: ls.get('verifier') });
      const me = await (await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: 'Bearer ' + token } })).json();
      ls.set('account', me.userPrincipalName || me.mail || me.displayName || '');
      status('تمّ الربط ✓', 'ok');
    } catch (e) { status('تعذّر الربط: ' + e.message, 'err'); }
    return true;
  }

  async function getToken() {
    if (token && Date.now() < tokenExp) return token;
    const rt = ls.get('refresh');
    if (!rt) throw new Error('غير مربوط');
    try { return await tokenRequest({ grant_type: 'refresh_token', refresh_token: rt }); }
    catch (e) {
      if (e.code === 'invalid_grant') {           // انتهت صلاحية الرمز ـ دخول صامت دون واجهة
        ls.set('refresh', null);
        if (!ls.get('silent_tried') || Date.now() - +ls.get('silent_tried') > 3600e3) {
          ls.set('silent_tried', String(Date.now()));
          login(true);
        }
      }
      throw e;
    }
  }

  /* ────────── Graph ────────── */
  async function graph(path, opts = {}) {
    const t = await getToken();
    const r = await fetch(GRAPH + path, { ...opts, headers: { Authorization: 'Bearer ' + t, ...(opts.headers || {}) } });
    return r;
  }
  async function readText(path) {
    const r = await graph(`:/${path}:/content`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('قراءة ' + path + ' : ' + r.status);
    return r.text();
  }
  async function writeText(path, text, type) {
    const r = await graph(`:/${path}:/content`, { method: 'PUT', headers: { 'Content-Type': type || 'text/plain' }, body: text });
    if (!r.ok) throw new Error('كتابة ' + path + ' : ' + r.status);
    return r.json();
  }

  /* ────────── الدمج ────────── */
  async function syncNow(manual) {
    if (!linked() || !navigator.onLine) { if (manual && !navigator.onLine) status('لا يوجد اتصال بالإنترنت', 'err'); return; }
    if (busy) { again = true; return; }
    busy = true; again = false;
    status('…جارٍ المزامنة', 'busy');
    try {
      const remoteTxt = await readText('daftar.json');
      const remote = remoteTxt ? JSON.parse(remoteTxt) : { records: {}, assets: {} };
      remote.records ||= {}; remote.assets ||= {};

      let pulled = 0, pushed = false;
      const merged = { app: 'daftar-tahdeer', version: 1, records: {}, assets: {} };

      for (const st of STORES) {
        const local = Object.fromEntries((await DB.all(st)).map(r => [r.id, r]));
        const rem = remote.records[st] || {};
        const out = merged.records[st] = {};
        for (const id of new Set([...Object.keys(local), ...Object.keys(rem)])) {
          const a = local[id], b = rem[id];
          if (a && (!b || (a.ts || 0) >= (b.ts || 0))) {
            out[id] = a;
            if (!b || (a.ts || 0) > (b.ts || 0)) pushed = true;
          } else {
            out[id] = b;
            await DB.putRaw(st, b); pulled++;
          }
        }
      }

      // اللقطات : ملف لكل لقطة ، والفهرس يحمل وقت التعديل
      const localAssets = Object.fromEntries((await DB.all('assets')).map(r => [r.id, r]));
      for (const id of new Set([...Object.keys(localAssets), ...Object.keys(remote.assets)])) {
        const a = localAssets[id], bts = remote.assets[id];
        if (a && (bts == null || (a.ts || 0) > bts)) {
          await writeText(`assets/${id}.txt`, a.data);
          merged.assets[id] = a.ts || 0; pushed = true;
        } else if (!a || bts > (a.ts || 0)) {
          const data = await readText(`assets/${id}.txt`);
          if (data) { await DB.putRaw('assets', { id, data, ts: bts }); if (window.ASSETS) ASSETS[id] = data; pulled++; }
          merged.assets[id] = bts;
        } else merged.assets[id] = a.ts || 0;
      }

      if (pushed || !remoteTxt) {
        merged.savedAt = new Date().toISOString();
        await writeText('daftar.json', JSON.stringify(merged), 'application/json');
      }
      ls.set('last', String(Date.now()));
      status(`تمّت المزامنة ${new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}` +
             (pulled ? ` · وصل ${ar(pulled)} تعديل` : ''), 'ok');
      if (pulled && typeof window.reloadFromDB === 'function') await window.reloadFromDB();
    } catch (e) {
      console.warn('sync', e);
      status(linked() ? 'تعذّرت المزامنة ـ ستُعاد تلقائياً' : 'انتهت جلسة الربط ـ اضغط «ربط الحساب»', 'err');
    } finally {
      busy = false;
      if (again) schedule(1500);
    }
  }

  function schedule(ms) {
    if (!linked()) return;
    clearTimeout(timer);
    timer = setTimeout(() => syncNow(), ms);
  }

  /* ────────── الإقلاع ────────── */
  async function init() {
    const back = await handleRedirect();
    DB.onWrite = () => schedule(8000);
    status(linked() ? (ls.get('last_msg') || 'مربوط') : 'غير مربوط', linked() ? 'ok' : '');
    if (linked()) syncNow();
    else if (back) status(ls.get('last_msg') || 'غير مربوط', 'err');
    setInterval(() => { if (!document.hidden) syncNow(); }, 120000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(500); });
    window.addEventListener('online', () => schedule(500));
    window.addEventListener('pagehide', () => { if (timer) syncNow(); });
  }

  function unlink() {
    if (!confirm('فصل OneDrive عن هذا الجهاز؟ تبقى بياناتك محفوظة هنا وفي OneDrive.')) return;
    ['refresh', 'account', 'last', 'last_msg'].forEach(k => ls.set(k, null));
    token = null;
    status('غير مربوط');
    renderPanel();
  }

  /* لوحة الإعدادات */
  function renderPanel() {
    const box = document.getElementById('syncBox'); if (!box) return;
    const acc = ls.get('account');
    box.innerHTML = `
      <div class="grid2">
        <label>معرّف التطبيق (Client ID)
          <input id="syncClient" dir="ltr" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value="${esc(clientId())}"></label>
        <label>عنوان إعادة التوجيه (يُسجَّل في Microsoft)
          <input dir="ltr" readonly value="${esc(redirectUri())}" onclick="this.select()"></label>
      </div>
      <div class="toolbar">
        ${linked()
          ? `<span class="hint">مربوط بـ <b dir="ltr">${esc(acc || 'حساب Microsoft')}</b></span>
             <button class="btn primary" id="syncNowBtn">مزامنة الآن</button>
             <button class="btn" id="syncUnlink">فصل</button>`
          : `<button class="btn primary" id="syncLogin">ربط الحساب</button>`}
        <span id="syncState" class="syncstate"></span>
      </div>`;
    status(linked() ? (ls.get('last_msg') || 'مربوط') : 'غير مربوط', linked() ? 'ok' : '');
    box.onchange = e => { if (e.target.id === 'syncClient') ls.set('client', e.target.value.trim()); };
    box.onclick = e => {
      if (e.target.id === 'syncLogin') { ls.set('client', document.getElementById('syncClient').value.trim()); login(); }
      if (e.target.id === 'syncNowBtn') syncNow(true);
      if (e.target.id === 'syncUnlink') unlink();
    };
  }

  return { init, syncNow, renderPanel, get linked() { return linked(); } };
})();
