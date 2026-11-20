// Demo build only: answers /api/* requests in the browser instead of server.js, so the site can be
// hosted as static files. Mirrors the server's rules; data lives in this visitor's localStorage.
// window.__DEMO_CONFIG__ is injected by scripts/build-demo.mjs from config.js.
(() => {
  const CFG = window.__DEMO_CONFIG__;
  const KEY = 'barbershop-demo-v1';
  const PASSWORD = 'demo';

  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  function nowInShopTz() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: CFG.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
  }
  const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------- state ---------- */
  let state;
  // Returns false when the browser refused to store it (quota, private mode): the data then lives in memory only.
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; } }
  function seed() {
    const s = { settings: { ...clone(CFG.defaults), version: 0 }, bookings: [], nextId: 1, tokens: [] };
    // A few plausible bookings so the admin panel isn't empty on first visit.
    const today = nowInShopTz().date, tomorrow = addDays(today, 1);
    const svc = (id) => s.settings.services.find((x) => x.id === id) || s.settings.services[0];
    const m = s.settings.masters;
    const samples = [
      [today, '15:00', 'combo', m[0], 'Максим Королёв', '+7 (916) 204-11-38', 'Оставить длину сверху', 'confirmed'],
      [today, '17:30', 'beard', m[1 % m.length], 'Игорь Савин', '+7 (903) 557-90-12', '', 'new'],
      [tomorrow, '12:00', 'kids', m[2 % m.length], 'Андрей Петров', '+7 (925) 118-40-77', 'Сыну 7 лет', 'new'],
      [tomorrow, '18:00', 'haircut', m[0], 'Олег Миронов', '+7 (985) 340-22-61', '', 'new'],
    ];
    for (const [date, time, sid, master, name, phone, comment, status] of samples) {
      const sv = svc(sid);
      s.bookings.push({ id: s.nextId++, name, phone, comment, status, date, start_min: toMin(time), duration: sv.duration,
        service_id: sv.id, service_name: sv.name, price: sv.price, master_id: master.id, master_name: master.name, created_at: new Date().toISOString() });
    }
    return s;
  }
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch { state = null; }
  if (!state || !state.settings) { state = seed(); save(); }
  const S = () => state.settings;
  const svcById = (id) => S().services.find((x) => x.id === id);
  const mstById = (id) => S().masters.find((x) => x.id === id);

  /* ---------- scheduling (same rules as server.js) ---------- */
  const active = (date) => state.bookings.filter((b) => b.date === date && b.status !== 'cancelled');
  const isFree = (busy, mid, start, dur) => !busy.some((b) => b.master_id === mid && start < b.start_min + b.duration && b.start_min < start + dur);
  function isBookableDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const today = nowInShopTz().date;
    return date >= today && date <= addDays(today, CFG.daysAhead - 1);
  }
  function freeSlots(date, dur, masterId) {
    const busy = active(date), now = nowInShopTz();
    const cands = masterId === 'any' ? S().masters.map((m) => m.id) : [masterId];
    const out = [];
    for (let t = toMin(S().openTime); t + dur <= toMin(S().closeTime); t += CFG.slotStepMinutes) {
      if (date === now.date && t <= now.minutes) continue;
      const free = cands.filter((id) => isFree(busy, id, t, dur));
      if (free.length) out.push({ time: toHHMM(t), masters: free });
    }
    return out;
  }

  /* ---------- settings validation (condensed from server.js) ---------- */
  function validate(input) {
    const str = (v, max, label, req) => { const s = typeof v === 'string' ? v.trim() : ''; if (req && !s) throw new Error(`Заполните поле «${label}»`); if (s.length > max) throw new Error(`Поле «${label}» длиннее ${max} символов`); return s; };
    const int = (v, min, max, label) => { const n = v === '' || v == null ? NaN : Number(v); if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label}: целое число от ${min} до ${max}`); return n; };
    const link = (v, label) => { const s = str(v, 200, label); if (s && !/^https?:\/\/\S+$/.test(s)) throw new Error(`${label}: ссылка должна начинаться с https:// или http://`); return s; };
    // In the demo a photo is a small data: URL kept in this browser; the real site stores files and keeps their path.
    const photo = (v, label) => { const s = typeof v === 'string' ? v : ''; if (s && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]{1,400000}$/.test(s)) throw new Error(`${label}: неверный файл`); return s; };
    const ids = (arr, label, map) => {
      if (!Array.isArray(arr) || !arr.length) throw new Error(`Добавьте хотя бы одну позицию в разделе «${label}»`);
      const seen = new Set();
      return arr.map((raw, i) => { const it = map(raw || {}, i + 1); it.id = typeof raw.id === 'string' && /^[a-z0-9_-]{1,40}$/.test(raw.id) ? raw.id : `x${Math.random().toString(16).slice(2, 10)}`; if (seen.has(it.id)) throw new Error(`Повторяющаяся позиция в разделе «${label}»`); seen.add(it.id); return it; });
    };
    const sh = input.shop || {};
    const phone = str(sh.phone, 30, 'Телефон', true);
    const digits = phone.replace(/\D/g, '').length; if (digits < 10 || digits > 15) throw new Error('Телефон: от 10 до 15 цифр');
    const address = str(sh.address, 120, 'Адрес', true);
    const v = {
      shop: { name: str(sh.name, 60, 'Название', true), tagline: str(sh.tagline, 120, 'Подзаголовок'), phone, address,
        mapQuery: str(sh.mapQuery, 120, 'Адрес для карты') || address, instagram: link(sh.instagram, 'Instagram'), telegram: link(sh.telegram, 'Telegram') },
      openTime: String(input.openTime || ''), closeTime: String(input.closeTime || ''),
    };
    const T = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!T.test(v.openTime) || !(T.test(v.closeTime) || v.closeTime === '24:00')) throw new Error('Часы работы в формате ЧЧ:ММ');
    const day = toMin(v.closeTime) - toMin(v.openTime);
    if (day < 60) throw new Error('Закрытие должно быть хотя бы на час позже открытия');
    v.services = ids(input.services, 'Услуги', (s, n) => ({ name: str(s.name, 60, `Название услуги ${n}`, true), description: str(s.description, 200, `Описание услуги ${n}`),
      duration: int(s.duration, 15, Math.min(480, day), `Длительность услуги ${n} в минутах`), price: int(s.price, 0, 1e6, `Цена услуги ${n}`) }));
    v.masters = ids(input.masters, 'Мастера', (m, n) => ({ name: str(m.name, 40, `Имя мастера ${n}`, true), role: str(m.role, 60, `Должность мастера ${n}`), experience: str(m.experience, 60, `Опыт мастера ${n}`), photo: photo(m.photo, `Фото мастера ${n}`) }));
    const gal = Array.isArray(input.gallery) ? input.gallery : [];
    if (gal.length > 8) throw new Error('В галерее не больше 8 фото');
    v.gallery = gal.map((p) => photo(p, 'Фото галереи'));
    return v;
  }

  /* ---------- routes ---------- */
  const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const upcoming = (b, today) => b.date >= today && (b.status === 'new' || b.status === 'confirmed');

  function handle(method, url, body, auth) {
    const route = `${method} ${url.pathname}`;
    const q = url.searchParams;
    if (route === 'GET /api/config') {
      const today = nowInShopTz().date;
      return reply(200, { shop: S().shop, services: S().services, masters: S().masters, gallery: S().gallery || [], openTime: S().openTime, closeTime: S().closeTime, privacy: { ...CFG.privacy, telegram: false },
        dates: Array.from({ length: CFG.daysAhead }, (_, i) => addDays(today, i)) });
    }
    if (route === 'GET /api/slots') {
      const date = q.get('date') || '', sv = svcById(q.get('service')), m = q.get('master') || 'any';
      if (!isBookableDate(date)) return reply(400, { error: 'Неверная дата' });
      if (!sv) return reply(400, { error: 'Неизвестная услуга' });
      if (m !== 'any' && !mstById(m)) return reply(400, { error: 'Неизвестный мастер' });
      return reply(200, { slots: freeSlots(date, sv.duration, m).map((s) => s.time) });
    }
    if (route === 'POST /api/bookings') {
      if (body.consent !== true) return reply(400, { error: 'Нужно согласие на обработку персональных данных' });
      const name = String(body.name || '').trim(), phone = String(body.phone || '').trim(), comment = String(body.comment || '').trim();
      const sv = svcById(body.serviceId), mid = String(body.masterId || 'any'), date = String(body.date || ''), time = String(body.time || '');
      if (name.length < 2 || name.length > 60) return reply(400, { error: 'Укажите имя' });
      const d = phone.replace(/\D/g, '').length; if (d < 10 || d > 15) return reply(400, { error: 'Укажите корректный телефон' });
      if (comment.length > 500) return reply(400, { error: 'Комментарий слишком длинный' });
      if (!sv) return reply(400, { error: 'Выберите услугу' });
      if (body.price != null && Number(body.price) !== sv.price) return reply(400, { error: 'Цена услуги изменилась' });
      if (mid !== 'any' && !mstById(mid)) return reply(400, { error: 'Выберите мастера' });
      if (!isBookableDate(date)) return reply(400, { error: 'Выберите дату' });
      const slot = freeSlots(date, sv.duration, mid).find((s) => s.time === time);
      if (!slot) return reply(409, { error: 'Это время уже заняли. Выберите другое.' });
      const m = mstById(slot.masters[0]);
      const b = { id: state.nextId++, name, phone, comment, status: 'new', date, start_min: toMin(time), duration: sv.duration,
        service_id: sv.id, service_name: sv.name, price: sv.price, master_id: m.id, master_name: m.name, created_at: new Date().toISOString(), consent_at: new Date().toISOString(), cancel_token: [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, '0')).join('') };
      state.bookings.push(b); save();
      return reply(201, { id: b.id, date, time, service: sv.name, price: sv.price, master: m.name, manageUrl: `booking.html?t=${b.cancel_token}` });
    }
    if (route === 'GET /api/booking' || route === 'POST /api/booking/cancel') {
      const t = String(method === 'POST' ? body.t : q.get('t') || '');
      const b = /^[a-f0-9]{32}$/.test(t) ? state.bookings.find((x) => x.cancel_token === t) : null;
      if (!b) return reply(404, { error: 'Запись не найдена' });
      const now = nowInShopTz(), before = CFG.cancelBeforeMinutes ?? 120;
      const left = (Date.parse(`${b.date}T00:00:00Z`) - Date.parse(`${now.date}T00:00:00Z`)) / 60000 + b.start_min - now.minutes;
      const canCancel = ['new', 'confirmed'].includes(b.status) && left >= before;
      if (method === 'POST') {
        if (b.status === 'cancelled') return reply(200, { ok: true, status: 'cancelled' });
        if (!canCancel) return reply(409, { error: `Отменить онлайн уже нельзя, позвоните: ${S().shop.phone}` });
        b.status = 'cancelled'; save(); return reply(200, { ok: true, status: 'cancelled' });
      }
      return reply(200, { date: b.date, time: toHHMM(b.start_min), duration: b.duration, service: b.service_name, master: b.master_name, price: b.price,
        status: b.status, canCancel, cancelBeforeMinutes: before, shop: { name: S().shop.name, address: S().shop.address, phone: S().shop.phone } });
    }
    if (route === 'POST /api/admin/login') {
      if (body.password !== PASSWORD) return reply(401, { error: 'Неверный пароль. В демо пароль: demo' });
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      state.tokens = [...(state.tokens || []).slice(-9), token]; save();
      return reply(200, { token });
    }
    if (url.pathname.startsWith('/api/admin/')) {
      if (!(state.tokens || []).includes(auth)) return reply(401, { error: 'Нужна авторизация' });
      if (route === 'POST /api/admin/logout') { state.tokens = state.tokens.filter((t) => t !== auth); save(); return reply(200, { ok: true }); }
      if (route === 'GET /api/admin/bookings') {
        const from = q.get('from') || nowInShopTz().date;
        const rows = state.bookings.filter((b) => b.date >= from).sort((a, b) => a.date.localeCompare(b.date) || a.start_min - b.start_min)
          .map((b) => ({ id: b.id, name: b.name, phone: b.phone, comment: b.comment, status: b.status, createdAt: b.created_at, date: b.date,
            time: toHHMM(b.start_min), endTime: toHHMM(b.start_min + b.duration), serviceId: b.service_id, service: b.service_name, price: b.price,
            masterId: b.master_id, master: mstById(b.master_id)?.name ?? b.master_name }));
        return reply(200, { bookings: rows });
      }
      if (route === 'GET /api/admin/settings') return reply(200, S());
      if (route === 'PUT /api/admin/settings') {
        if (body.version !== S().version) return reply(409, { error: 'Настройки уже изменили в другой вкладке. Нажмите «Отменить», чтобы загрузить свежие, и внесите правки заново.' });
        let v; try { v = validate(body); } catch (e) { return reply(400, { error: e.message }); }
        const today = nowInShopTz().date;
        const keptS = new Set(v.services.map((x) => x.id)), keptM = new Set(v.masters.map((x) => x.id));
        for (const x of S().services) if (!keptS.has(x.id)) { const n = state.bookings.filter((b) => upcoming(b, today) && b.service_id === x.id).length; if (n) return reply(409, { error: `Нельзя удалить: услуга «${x.name}» есть в ${n} предстоящих записях. Сначала отмените или выполните их.` }); }
        for (const x of S().masters) if (!keptM.has(x.id)) { const n = state.bookings.filter((b) => upcoming(b, today) && b.master_id === x.id).length; if (n) return reply(409, { error: `Нельзя удалить: мастер «${x.name}» есть в ${n} предстоящих записях. Сначала отмените или выполните их.` }); }
        const open = toMin(v.openTime), close = toMin(v.closeTime);
        const outside = state.bookings.filter((b) => upcoming(b, today) && (b.start_min < open || b.start_min + b.duration > close));
        if (outside.length) return reply(409, { error: `Предстоящих записей вне новых часов работы: ${outside.length}, первая ${outside[0].date} в ${toHHMM(outside[0].start_min)}. Перенесите или отмените их, потом меняйте часы.` });
        const prev = state.settings;
        v.version = S().version + 1; state.settings = v;
        if (!save()) { state.settings = prev; return reply(507, { error: 'Не хватило места в браузере. Уберите часть фото или уменьшите их число.' }); }
        return reply(200, v);
      }
      const m = url.pathname.match(/^\/api\/admin\/bookings\/(\d+)$/);
      if (m && method === 'PATCH') {
        if (!['new', 'confirmed', 'done', 'cancelled'].includes(body.status)) return reply(400, { error: 'Неверный статус' });
        const cur = state.bookings.find((b) => b.id === Number(m[1]));
        if (!cur) return reply(404, { error: 'Запись не найдена' });
        if (body.from != null && body.from !== cur.status) return reply(409, { error: 'Статус записи уже изменился (возможно, клиент отменил её). Список обновлён.' });
        if (cur.status === 'cancelled' && body.status !== 'cancelled') {
          if (!mstById(cur.master_id)) return reply(409, { error: 'Мастер этой записи удалён из настроек, вернуть её нельзя' });
          if (!isFree(active(cur.date), cur.master_id, cur.start_min, cur.duration)) return reply(409, { error: 'Это время у мастера уже занято другой записью' });
        }
        cur.status = body.status; save();
        return reply(200, { ok: true });
      }
    }
    return reply(404, { error: 'Not found' });
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return realFetch(input, init);
    if (url.pathname === '/api/admin/upload') {
      const t = String(new Headers(init.headers || {}).get('Authorization') || '').replace(/^Bearer /, '');
      if (!state.tokens.includes(t)) return reply(401, { error: 'Нужна авторизация' });
      const dataUrl = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(init.body); });
      return reply(201, { path: dataUrl });
    }
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch { return reply(400, { error: 'Ошибка запроса' }); }
    if (!body || typeof body !== 'object') return reply(400, { error: 'Ошибка запроса' });
    const auth = String(new Headers(init.headers || {}).get('Authorization') || '').replace(/^Bearer /, '');
    await new Promise((r) => setTimeout(r, 120)); // feel like a network round trip
    return handle((init.method || 'GET').toUpperCase(), url, body, auth);
  };

  /* ---------- demo note ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const isAdmin = /admin(\.html)?$/.test(location.pathname);
    const bar = document.createElement('div');
    bar.className = 'demo-note';
    bar.innerHTML = isAdmin
      ? '<span>Демо-версия. Пароль: <b>demo</b></span><a href="./">На сайт</a><button type="button">Сбросить демо</button>'
      : '<span>Демо-версия. Данные хранятся только в вашем браузере</span><a href="admin.html">Админка</a><button type="button">Сбросить демо</button>';
    bar.querySelector('button').addEventListener('click', () => { try { localStorage.removeItem(KEY); sessionStorage.clear(); } catch { /* ignore */ } location.reload(); });
    document.body.append(bar);
  });
})();
