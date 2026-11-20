// The client's own page for one booking: the details, a calendar file and a cancel button. The link carries the key (?t=...).
const el = (tag, text, attrs = {}) => Object.assign(document.createElement(tag), { textContent: text, ...attrs });
const root = document.getElementById('legal');
const token = new URLSearchParams(location.search).get('t') || '';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const longDate = (s) => { const [y, m, d] = s.split('-').map(Number); return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTHS[m - 1]}`; };

// Floating local time (no zone) so the event lands at the shop's local hour in whatever zone the client's calendar is in.
// The UID is a hash, not the cancel key: a calendar that is shared or synced would otherwise expose the key.
async function icsFile(b) {
  const uid = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join('');
  const [h, m] = b.time.split(':').map(Number);
  const end = h * 60 + m + b.duration;
  const addDay = (date, n) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const endDate = addDay(b.date, Math.floor(end / 1440)); // a visit that ends at midnight or later ends on the next day
  const endTime = `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  const stamp = (date, hhmm) => `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
  const esc = (t) => String(t).replace(/\\/g, '\\\\').replace(/[;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
  // RFC 5545: lines are cut at 75 octets and continued with a leading space.
  const fold = (line) => { const out = []; let cur = '', bytes = 0; for (const ch of line) { const n = new TextEncoder().encode(ch).length; if (bytes + n > 74) { out.push(cur); cur = ' '; bytes = 1; } cur += ch; bytes += n; } out.push(cur); return out.join('\r\n'); };
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//booking//RU', 'BEGIN:VEVENT',
    `UID:${uid}@booking`, `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d+/g, '')}`,
    `DTSTART:${stamp(b.date, b.time)}`, `DTEND:${stamp(endDate, endTime)}`,
    `SUMMARY:${esc(`${b.service}, ${b.shop.name}`)}`, `LOCATION:${esc(b.shop.address)}`,
    `DESCRIPTION:${esc(`Мастер: ${b.master}. Телефон: ${b.shop.phone}`)}`, 'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n');
}

async function load() {
  fetch('/api/config').then((r) => r.json()).then((c) => { if (c.content?.theme) document.documentElement.dataset.theme = c.content.theme; }).catch(() => {}); // the demo's niche can change after the page was built
  const res = await fetch(`/api/booking?t=${encodeURIComponent(token)}`);
  if (res.status === 404) return root.replaceChildren(el('h1', 'Запись не найдена'), el('p', 'Проверьте ссылку или позвоните нам.'));
  if (!res.ok) return root.replaceChildren(el('h1', 'Не удалось загрузить запись'), el('p', 'Попробуйте обновить страницу через минуту.'));
  paint(await res.json());
}

function paint(b) {
  document.title = `Ваша запись — ${b.shop.name}`;
  const rows = [['Услуга', b.service], ['Мастер', b.master], ['Дата', longDate(b.date)], ['Время', b.time], ['Адрес', b.shop.address], ['Итого', `${Number(b.price).toLocaleString('ru-RU')} ₽`]];
  const msg = el('p', '', { role: 'status' });
  const actions = [];
  if (b.status !== 'cancelled') {
    actions.push(Object.assign(el('button', 'Добавить в календарь'), { type: 'button', className: 'btn btn--secondary', onclick: async () => {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([await icsFile(b)], { type: 'text/calendar' })), download: 'zapis.ics' });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10_000); // revoking at once can cancel the download on iOS
    } }));
    if (b.reminderBot && ['new', 'confirmed'].includes(b.status)) actions.push(Object.assign(el('a', 'Напомнить в Telegram'), { className: 'btn btn--secondary', target: '_blank', rel: 'noopener', href: `https://t.me/${b.reminderBot}?start=r_${token}` }));
    if (b.canCancel) actions.push(Object.assign(el('button', 'Отменить запись'), { type: 'button', className: 'btn btn--secondary', onclick: async (e) => {
      if (!confirm('Отменить запись?')) return;
      e.target.disabled = true;
      const r = await fetch('/api/booking/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token }) });
      if (r.ok) return load();
      msg.textContent = (await r.json().catch(() => ({}))).error || 'Не получилось отменить'; e.target.disabled = false;
    } }));
    else if (['new', 'confirmed'].includes(b.status)) msg.textContent = `Отменить онлайн можно не позже, чем за ${Math.round(b.cancelBeforeMinutes / 60)} ч до визита. Позвоните: ${b.shop.phone}.`;
  }
  root.replaceChildren(
    el('h1', b.status === 'cancelled' ? 'Запись отменена' : 'Ваша запись'),
    ...(b.status === 'done' ? [el('p', 'Визит состоялся. Спасибо!')] : []),
    Object.assign(document.createElement('dl'), {}),
    msg, Object.assign(document.createElement('div'), { className: 'photo__row' }), Object.assign(el('a', '← На сайт'), { href: './' }));
  const dl = root.querySelector('dl');
  dl.append(...rows.flatMap(([k, v]) => [el('dt', k), el('dd', v)]));
  root.querySelector('.photo__row').append(...actions);
}

load().catch(() => { root.textContent = 'Не удалось загрузить запись. Обновите страницу.'; });
