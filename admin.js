const $ = (s) => document.querySelector(s);
const KEY = 'admin_token';
const STATUS = { new: 'Новая', confirmed: 'Подтверждена', done: 'Выполнена', cancelled: 'Отменена' };
const token = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
const setToken = (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* ignore */ } };
const fmtPrice = (n) => (n == null ? '—' : `${Number(n).toLocaleString('ru-RU')} ₽`);

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) el.append(k);
  return el;
}

class AuthError extends Error {}
async function api(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(opts.headers || {}) } });
  let data = {}; try { data = await res.json(); } catch { /* ignore */ }
  if (res.status === 401) throw new AuthError(data.error || 'Нужна авторизация');
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

let bookings = [], today = '', timer = null, cfgLoaded = false;

function showLogin(msg = '') {
  clearInterval(timer); timer = null;
  setToken('');
  $('#app').hidden = true; $('#login').hidden = false;
  $('#login-err').textContent = msg; $('#pw').value = ''; $('#pw').focus();
}
function showApp() { $('#login').hidden = true; $('#app').hidden = false; }

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button'); btn.disabled = true; $('#login-err').textContent = '';
  try {
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ошибка входа');
    setToken(data.token); start();
  } catch (err) { $('#login-err').textContent = err.message; }
  btn.disabled = false;
});
$('#logout').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* token is dropped locally anyway */ }
  forgetSettings();
  showLogin();
});
$('#refresh').addEventListener('click', () => load());
$('#f-master').addEventListener('change', render);
$('#f-status').addEventListener('change', render);

// Re-read on every refresh so "today" moves forward overnight and edits from Settings show up.
async function loadConfig() {
  const cfg = await (await fetch('/api/config')).json();
  today = cfg.dates[0];
  $('#shop-name').textContent = cfg.shop.name;
  document.title = `Админ-панель — ${cfg.shop.name}`;
  const sel = $('#f-master'), keep = sel.value;
  sel.replaceChildren(h('option', { value: '', text: 'Все' }), ...cfg.masters.map((m) => h('option', { value: m.id, text: m.name })));
  sel.value = cfg.masters.some((m) => m.id === keep) ? keep : '';
  cfgLoaded = true;
}

async function start() {
  showApp();
  try { await loadConfig(); } catch { $('#msg').textContent = 'Не удалось загрузить настройки'; }
  await load();
  clearInterval(timer);
  timer = setInterval(load, 60000);
}

async function load() {
  const btn = $('#refresh'); btn.disabled = true;
  try {
    await loadConfig().catch(() => {});
    const data = await api(`/api/admin/bookings?from=${today || ''}`);
    bookings = data.bookings; $('#msg').textContent = '';
    paintReport();
    $('#updated').textContent = `Обновлено ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    render();
  } catch (err) {
    if (err instanceof AuthError) showLogin('Сессия истекла, войдите снова');
    else $('#msg').textContent = err.message;
  }
  btn.disabled = false;
}

async function setStatus(id, status, btn, from) {
  btn.disabled = true;
  try { await api(`/api/admin/bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ status, from }) }); await load(); }
  catch (err) {
    if (err instanceof AuthError) showLogin('Сессия истекла, войдите снова');
    else { $('#msg').textContent = err.message; btn.disabled = false; load().catch(() => {}); }
  }
}

function countLabel(n) {
  const m10 = n % 10, m100 = n % 100;
  const w = m10 === 1 && m100 !== 11 ? 'запись' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'записи' : 'записей';
  return `${n} ${w}`;
}

function dateTitle(d) {
  const dt = new Date(...d.split('-').map((v, i) => (i === 1 ? v - 1 : +v)));
  const s = dt.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function render() {
  const todays = bookings.filter((b) => b.date === today);
  $('#st-count').textContent = String(todays.filter((b) => b.status !== 'cancelled').length);
  $('#st-rev').textContent = fmtPrice(todays.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + (b.price || 0), 0));
  $('#st-total').textContent = String(bookings.filter((b) => b.status !== 'cancelled').length);

  const fm = $('#f-master').value, fs = $('#f-status').value;
  const shown = bookings.filter((b) => (!fm || b.masterId === fm) && (!fs || b.status === fs));
  const list = $('#list'); list.replaceChildren();
  if (!shown.length) { list.append(h('p', { class: 'empty', text: 'Записей нет' })); return; }

  const byDate = new Map();
  shown.forEach((b) => { if (!byDate.has(b.date)) byDate.set(b.date, []); byDate.get(b.date).push(b); });
  for (const [date, items] of byDate) {
    const day = h('section', { class: 'day' }, h('h2', {}, dateTitle(date), h('small', { text: (date === today ? 'сегодня · ' : '') + countLabel(items.length) })));
    items.forEach((b) => day.append(row(b)));
    list.append(day);
  }
}

function row(b) {
  const acts = h('div', { class: 'acts' });
  const btn = (label, status, cls) => acts.append(h('button', { type: 'button', class: cls || '', text: label, onclick: (e) => setStatus(b.id, status, e.currentTarget, b.status) }));
  if (b.status === 'new') btn('Подтвердить', 'confirmed');
  if (b.status === 'new' || b.status === 'confirmed') btn('Выполнено', 'done');
  if (b.status === 'new' || b.status === 'confirmed') btn('Отменить', 'cancelled', 'bad');
  if (b.status === 'cancelled' || b.status === 'done') btn('Вернуть', 'new');
  const tel = b.phone.replace(/[^\d+]/g, '');
  return h('article', { class: `row ${b.status}` },
    h('div', { class: 'time', text: `${b.time}–${b.endTime}` }),
    h('div', { class: 'who' }, h('b', { text: b.name }), h('a', { href: `tel:${tel}`, text: b.phone })),
    h('div', { class: 'what' }, h('b', { text: b.service }), h('small', { text: `${b.master} · ${fmtPrice(b.price)}` })),
    h('div', { class: 'right' }, h('span', { class: `badge ${b.status}`, text: STATUS[b.status] || b.status }), acts),
    b.comment ? h('div', { class: 'comment', text: `Комментарий: ${b.comment}` }) : null);
}

/* ---------- settings ---------- */
let saved = null, draft = null, dirty = false, saving = false;
const DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240];
const clone = (o) => JSON.parse(JSON.stringify(o));

function showTab(name) {
  const isSettings = name === 'settings';
  $('#view-settings').hidden = !isSettings;
  $('#view-bookings').hidden = isSettings;
  $('#refresh').hidden = isSettings;
  $('#updated').hidden = isSettings;
  for (const [id, on] of [['#tab-bookings', !isSettings], ['#tab-settings', isSettings]]) {
    $(id).setAttribute('aria-selected', String(on));
    $(id).tabIndex = on ? 0 : -1;
  }
  if (isSettings && !draft) openSettings();
}
$('#tab-bookings').addEventListener('click', () => showTab('bookings'));
$('#tab-settings').addEventListener('click', () => showTab('settings'));
$('.tabs').addEventListener('keydown', (e) => {
  const map = { ArrowLeft: null, ArrowRight: null, Home: 'bookings', End: 'settings' };
  if (!(e.key in map)) return;
  e.preventDefault();
  const next = map[e.key] || ($('#tab-settings').getAttribute('aria-selected') === 'true' ? 'bookings' : 'settings');
  showTab(next); $(`#tab-${next}`).focus();
});
window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });

// Explicit logout forgets unsaved edits, so the next person on this browser doesn't see them.
function forgetSettings() { saved = draft = null; dirty = false; showTab('bookings'); }

async function openSettings(after) {
  const form = $('#settings-form');
  form.replaceChildren(h('p', { class: 'muted', text: 'Загрузка…' }));
  try {
    saved = await api('/api/admin/settings');
    draft = clone(saved);
    paintSettings(after);
  } catch (err) {
    if (err instanceof AuthError) return showLogin('Сессия истекла, войдите снова');
    form.replaceChildren(h('p', { class: 'err', text: err.message }));
  }
}

function setDirty(on) {
  dirty = on;
  $('#set-status').textContent = on ? 'Есть несохранённые изменения' : 'Все изменения сохранены';
  $('#set-status').classList.toggle('is-dirty', on);
  $('#set-save').disabled = !on || saving;
  $('#set-reset').disabled = !on || saving;
}

// A labelled input bound to obj[key]; edits mark the form dirty without re-rendering.
function field(label, obj, key, { type = 'text', hint, wide, max, ...attrs } = {}) {
  const id = `fld-${Math.random().toString(36).slice(2, 8)}`;
  const input = h('input', { id, type, value: obj[key] ?? '', maxlength: max, ...attrs,
    oninput: (e) => { obj[key] = type === 'number' ? e.target.value === '' ? '' : Number(e.target.value) : e.target.value; setDirty(true); } });
  return h('div', { class: `fld${wide ? ' fld--wide' : ''}` }, h('label', { for: id, text: label }), input, hint ? h('small', { text: hint }) : null);
}

// After a list action redraws the form, put keyboard focus back where the user was.
function focusItem(kind, index, act) {
  const items = document.querySelectorAll(`.item[data-kind="${kind}"]`);
  if (!items.length) return;
  const item = items[Math.min(index, items.length - 1)];
  const btn = item.querySelector(`[data-act="${act}"]:not([disabled])`) || item.querySelector('[data-act]:not([disabled])') || item.querySelector('input');
  btn?.focus();
}

function itemRow(list, i, kind, cells) {
  const item = list[i];
  const move = (dir) => {
    const j = i + dir; [list[i], list[j]] = [list[j], list[i]];
    setDirty(true); paintSettings(() => focusItem(kind, j, dir < 0 ? 'up' : 'down'));
  };
  const label = item.name || (kind === 'service' ? 'новая услуга' : 'новый мастер');
  return h('div', { class: 'item', 'data-kind': kind },
    h('div', { class: 'item__fields' }, cells),
    h('div', { class: 'item__acts' },
      h('button', { type: 'button', class: 'icon-btn', 'data-act': 'up', 'aria-label': `Выше: ${label}`, disabled: i === 0, onclick: () => move(-1), text: '↑' }),
      h('button', { type: 'button', class: 'icon-btn', 'data-act': 'down', 'aria-label': `Ниже: ${label}`, disabled: i === list.length - 1, onclick: () => move(1), text: '↓' }),
      h('button', { type: 'button', class: 'icon-btn icon-btn--bad', 'data-act': 'del', 'aria-label': `Удалить: ${label}`, disabled: list.length === 1,
        onclick: () => { list.splice(i, 1); setDirty(true); paintSettings(() => focusItem(kind, i, 'del')); }, text: '×' })));
}

// Photos are shrunk in the browser first (phone photos are several MB), then sent as plain JPEG bytes.
const PHOTO_MAX_SIDE = window.__DEMO_CONFIG__ ? 800 : 1600;
async function shrinkPhoto(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, PHOTO_MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('Не удалось обработать фото'))), 'image/jpeg', window.__DEMO_CONFIG__ ? 0.7 : 0.85));
}
async function uploadPhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('Нужна фотография');
  const blob = await shrinkPhoto(file);
  const r = await api('/api/admin/upload', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
  return r.path;
}
// A picker for one photo stored at obj[key] (a master) or one slot of a list.
function photoPicker(label, obj, key, { onUploaded } = {}) {
  const id = `fld-${Math.random().toString(36).slice(2, 8)}`;
  const msg = h('small', { class: 'photo__msg', role: 'status' });
  const input = h('input', { id, type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    msg.textContent = 'Загружаем…';
    try { const p = await uploadPhoto(f); if (onUploaded) onUploaded(p); else obj[key] = p; setDirty(true); paintSettings(); }
    catch (err) { if (err instanceof AuthError) return showLogin('Сессия истекла, войдите снова'); msg.textContent = err.message; }
  } });
  return h('div', { class: 'fld fld--wide photo' },
    h('span', { class: 'photo__label', text: label }),
    h('div', { class: 'photo__row' },
      obj[key] ? h('img', { class: 'photo__thumb', src: obj[key], alt: '' }) : h('span', { class: 'photo__empty', 'aria-hidden': 'true', text: '+' }),
      input,
      h('button', { type: 'button', class: 'btn btn--secondary btn--sm', text: obj[key] ? 'Заменить' : 'Загрузить фото', onclick: () => input.click() }),
      obj[key] ? h('button', { type: 'button', class: 'btn btn--secondary btn--sm', text: 'Убрать', onclick: () => { obj[key] = ''; setDirty(true); paintSettings(); } }) : null),
    msg);
}

function durationSelect(svc) {
  const id = `fld-${Math.random().toString(36).slice(2, 8)}`;
  const opts = DURATIONS.includes(svc.duration) ? DURATIONS : [...DURATIONS, svc.duration].sort((a, b) => a - b);
  const sel = h('select', { id, onchange: (e) => { svc.duration = Number(e.target.value); setDirty(true); } },
    opts.map((m) => h('option', { value: String(m), text: m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч${m % 60 ? ` ${m % 60} мин` : ''}` })));
  sel.value = String(svc.duration);
  return h('div', { class: 'fld fld--dur' }, h('label', { for: id, text: 'Длительность' }), sel);
}

// A select instead of <input type=time>, which shows AM/PM in English-locale browsers.
// Closing time may be 24:00 for shops open until midnight.
function timeSelect(label, obj, key, { midnight = false } = {}) {
  const id = `fld-${Math.random().toString(36).slice(2, 8)}`;
  const times = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
  if (midnight) times.push('24:00');
  if (!times.includes(obj[key])) times.push(obj[key]);
  const sel = h('select', { id, onchange: (e) => { obj[key] = e.target.value; setDirty(true); } }, times.sort().map((t) => h('option', { value: t, text: t })));
  sel.value = obj[key];
  return h('div', { class: 'fld' }, h('label', { for: id, text: label }), sel);
}

function paintSettings(after) {
  const d = draft, form = $('#settings-form');
  const section = (title, sub, ...body) => h('section', { class: 'set' }, h('header', {}, h('h2', { text: title }), sub ? h('p', { class: 'muted', text: sub }) : null), ...body);

  form.replaceChildren(
    section('Барбершоп', 'Эти данные видят клиенты на сайте',
      h('div', { class: 'grid2' },
        field('Название', d.shop, 'name', { max: 60, required: true }),
        field('Подзаголовок', d.shop, 'tagline', { max: 120, placeholder: 'Мужские стрижки и уход за бородой' }),
        field('Телефон', d.shop, 'phone', { type: 'tel', max: 30, required: true }),
        field('Адрес', d.shop, 'address', { max: 120, required: true }),
        field('Адрес для карты', d.shop, 'mapQuery', { max: 120, hint: 'Если пусто, карта ищет по адресу', wide: true }),
        field('Instagram', d.shop, 'instagram', { type: 'url', max: 200, placeholder: 'https://' }),
        field('Telegram', d.shop, 'telegram', { type: 'url', max: 200, placeholder: 'https://t.me/' }))),
    section('Часы работы', 'Одинаковые для всех дней. Запись идёт с шагом 30 минут',
      h('div', { class: 'grid2 grid2--narrow' },
        timeSelect('Открытие', d, 'openTime'),
        timeSelect('Закрытие', d, 'closeTime', { midnight: true }))),
    section('Услуги', 'Первая услуга показывается на главном экране сайта',
      h('div', { class: 'items' }, d.services.map((s, i) => itemRow(d.services, i, 'service', [
        field('Название', s, 'name', { max: 60, required: true }),
        durationSelect(s),
        field('Цена, ₽', s, 'price', { type: 'number', min: 0, step: 50, inputmode: 'numeric', required: true }),
        field('Описание', s, 'description', { max: 200, wide: true }),
      ]))),
      h('button', { type: 'button', class: 'btn btn--secondary btn--sm add', text: 'Добавить услугу',
        onclick: () => { d.services.push({ name: '', description: '', duration: 60, price: 1000 }); setDirty(true); paintSettings(() => focusLast('service')); } })),
    section('Мастера', 'Порядок важен: при выборе «Любой мастер» запись получает первый свободный по списку',
      h('div', { class: 'items' }, d.masters.map((m, i) => itemRow(d.masters, i, 'master', [
        field('Имя', m, 'name', { max: 40, required: true }),
        field('Должность', m, 'role', { max: 60, placeholder: 'Барбер' }),
        field('Опыт', m, 'experience', { max: 60, placeholder: '5 лет опыта' }),
        field('Строка о мастере', m, 'note', { max: 90, placeholder: 'Любит классические стрижки и аккуратные бороды' }),
        photoPicker('Фото', m, 'photo'),
      ]))),
      h('button', { type: 'button', class: 'btn btn--secondary btn--sm add', text: 'Добавить мастера',
        onclick: () => { d.masters.push({ name: '', role: '', experience: '', note: '', photo: '' }); setDirty(true); paintSettings(() => focusLast('master')); } })),
    section('Наши работы', 'Фото работ на сайте, до 8 штук. Первое фото показывается на первом экране вместо рисунка. Пока фото нет, блок «Наши работы» скрыт',
      h('div', { class: 'gallery' }, (d.gallery ||= []).map((src, i) => h('div', { class: 'gallery__item' },
        h('img', { src, alt: `Фото ${i + 1}` }),
        h('button', { type: 'button', class: 'icon-btn icon-btn--bad', 'aria-label': `Удалить фото ${i + 1}`, text: '×',
          onclick: () => { d.gallery.splice(i, 1); setDirty(true); paintSettings(); } })))),
      d.gallery.length < 8 ? photoPicker('Добавить фото', {}, 'v', { onUploaded: (p) => d.gallery.push(p) }) : null),
    h('div', { class: 'savebar' },
      h('p', { id: 'set-status', class: 'savebar__status', 'aria-live': 'polite', tabindex: '-1' }),
      h('p', { id: 'set-err', class: 'err', role: 'alert' }),
      h('div', { class: 'savebar__acts' },
        // Reset reloads from the server, which also picks up changes saved in another tab.
        h('button', { id: 'set-reset', type: 'button', class: 'btn btn--secondary btn--sm', text: 'Отменить',
          onclick: () => openSettings(() => $('#set-status').focus()) }),
        h('button', { id: 'set-save', type: 'submit', class: 'btn btn--primary btn--sm', text: 'Сохранить' }))));
  setDirty(JSON.stringify(draft) !== JSON.stringify(saved));
  after?.();
}

function focusLast(kind) {
  const all = document.querySelectorAll(`.item[data-kind="${kind}"]`);
  all[all.length - 1]?.querySelector('input')?.focus();
}

$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (saving || !dirty) return;
  const btn = $('#set-save');
  const sent = JSON.stringify(draft);
  saving = true; setDirty(true); btn.textContent = 'Сохраняем…';
  $('#set-err').textContent = '';
  try {
    saved = await api('/api/admin/settings', { method: 'PUT', body: sent });
    saving = false;
    if (JSON.stringify(draft) === sent) {
      draft = clone(saved);
      paintSettings();
      $('#set-status').textContent = 'Сохранено. Сайт уже показывает новые данные';
    } else {
      // The owner kept typing while the request was in flight: keep those edits, on top of the new version.
      draft.version = saved.version;
      btn.textContent = 'Сохранить'; setDirty(true);
    }
    loadConfig().catch(() => {});
  } catch (err) {
    saving = false;
    btn.textContent = 'Сохранить'; setDirty(true);
    if (err instanceof AuthError) return showLogin('Сессия истекла, войдите снова. Ваши правки сохранены в форме');
    $('#set-err').textContent = err.message;
  }
});

/* ---------- report for a period, and the CSV for Excel ---------- */
const addDaysStr = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
async function reportRows() {
  const days = Number($('#rp-days').value) || 30;
  const from = addDaysStr(today, -days);
  const { bookings: all } = await api(`/api/admin/bookings?from=${from}`);
  return { days, from, rows: all.filter((b) => b.date <= today) }; // the period ends today: future bookings are not "done" yet
}
// The visit counts as revenue when it was not cancelled. A price is a copy taken at booking time.
function summarize(rows) {
  const live = rows.filter((b) => b.status !== 'cancelled');
  const sum = (list) => list.reduce((s, b) => s + (Number(b.price) || 0), 0);
  const group = (key) => Object.entries(live.reduce((m, b) => { const g = (m[b[key]] ||= { n: 0, rev: 0 }); g.n++; g.rev += Number(b.price) || 0; return m; }, {}))
    .sort((a, b) => b[1].n - a[1].n);
  const phones = new Map(); for (const b of live) phones.set(b.phone.replace(/\D/g, ''), (phones.get(b.phone.replace(/\D/g, '')) || 0) + 1);
  return { total: rows.length, live: live.length, cancelled: rows.length - live.length, revenue: sum(live), byService: group('service'), byMaster: group('master'),
    returning: [...phones.values()].filter((n) => n > 1).length, clients: phones.size };
}
async function paintReport() {
  const box = $('#rp-body');
  try {
    const { rows } = await reportRows();
    const r = summarize(rows);
    if (!r.total) return box.replaceChildren(h('span', { class: 'muted', text: 'За этот период записей нет' }));
    const stat = (label, value) => h('div', { class: 'stat' }, h('span', { text: label }), h('b', { text: value }));
    const list = (title, entries) => h('div', { class: 'report__list' }, h('h3', { text: title }),
      h('ol', {}, entries.slice(0, 5).map(([name, g]) => h('li', {}, h('span', { text: name }), h('b', { text: `${g.n} · ${fmtPrice(g.rev)}` })))));
    box.replaceChildren(
      h('div', { class: 'stats stats--4' },
        stat('Записей', String(r.live)), stat('Выручка', fmtPrice(r.revenue)),
        stat('Отмен', `${r.cancelled}${r.total ? ` (${Math.round((r.cancelled / r.total) * 100)}%)` : ''}`),
        stat('Клиентов вернулось', `${r.returning} из ${r.clients}`)),
      h('div', { class: 'report__lists' }, list('Услуги', r.byService), list('Мастера', r.byMaster)));
  } catch (err) { if (err instanceof AuthError) showLogin('Сессия истекла, войдите снова'); else box.replaceChildren(h('span', { class: 'err', text: err.message })); }
}
// Excel in a Russian locale wants ';' as the separator and a BOM for UTF-8. A cell that starts with = + - @ could run as a
// formula, so it gets a leading apostrophe; phone numbers (digits, spaces, + and brackets only) are left as they are.
const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s) && !/^\+?[\d\s()-]+$/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function csvOf(rows) {
  const head = ['Дата', 'Время', 'Услуга', 'Мастер', 'Цена', 'Статус', 'Имя', 'Телефон', 'Комментарий', 'Создана'];
  const lines = rows.slice().sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .map((b) => [b.date, b.time, b.service, b.master, b.price ?? '', STATUS[b.status] || b.status, b.name, b.phone, b.comment, b.createdAt].map(csvCell).join(';'));
  return `﻿${[head.join(';'), ...lines].join('\r\n')}\r\n`;
}
$('#rp-days').addEventListener('change', paintReport);
$('#rp-csv').addEventListener('click', async (e) => {
  e.target.disabled = true;
  try {
    const { days, rows } = await reportRows();
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csvOf(rows)], { type: 'text/csv;charset=utf-8' })), download: `zapisi-${today}-${days}d.csv` });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  } catch (err) { $('#msg').textContent = err.message; }
  e.target.disabled = false;
});

if (token()) start(); else showLogin();
