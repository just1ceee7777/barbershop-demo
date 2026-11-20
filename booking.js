// The client's own page for one booking: the details, a calendar file and a cancel button. The link carries the key (?t=...).
const el = (tag, text, attrs = {}) => Object.assign(document.createElement(tag), { textContent: text, ...attrs });
const root = document.getElementById('legal');
const token = new URLSearchParams(location.search).get('t') || '';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const longDate = (s) => { const [y, m, d] = s.split('-').map(Number); return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTHS[m - 1]}`; };

// Floating local time (no zone) so the event lands at the shop's local hour in whatever zone the client's calendar is in.
function icsFile(b) {
  const stamp = (date, hhmm) => `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
  const [h, m] = b.time.split(':').map(Number);
  const end = h * 60 + m + b.duration;
  const endTime = `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  const esc = (t) => String(t).replace(/[\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//booking//RU', 'BEGIN:VEVENT',
    `UID:${token}@booking`, `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d+/g, '')}`,
    `DTSTART:${stamp(b.date, b.time)}`, `DTEND:${stamp(b.date, endTime)}`,
    `SUMMARY:${esc(`${b.service}, ${b.shop.name}`)}`, `LOCATION:${esc(b.shop.address)}`,
    `DESCRIPTION:${esc(`Мастер: ${b.master}. Телефон: ${b.shop.phone}`)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

async function load() {
  const res = await fetch(`/api/booking?t=${encodeURIComponent(token)}`);
  if (!res.ok) return root.replaceChildren(el('h1', 'Запись не найдена'), el('p', 'Проверьте ссылку или позвоните нам.'));
  paint(await res.json());
}

function paint(b) {
  document.title = `Ваша запись — ${b.shop.name}`;
  const rows = [['Услуга', b.service], ['Мастер', b.master], ['Дата', longDate(b.date)], ['Время', b.time], ['Адрес', b.shop.address], ['Итого', `${Number(b.price).toLocaleString('ru-RU')} ₽`]];
  const msg = el('p', '', { role: 'status' });
  const actions = [];
  if (b.status !== 'cancelled') {
    actions.push(Object.assign(el('button', 'Добавить в календарь'), { type: 'button', className: 'btn btn--secondary', onclick: () => {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([icsFile(b)], { type: 'text/calendar' })), download: 'zapis.ics' });
      a.click(); URL.revokeObjectURL(a.href);
    } }));
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
