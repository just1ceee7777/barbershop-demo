// Public site: renders everything from /api/config. Server/user text is inserted via textContent only.
const S = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  scissors: `<svg viewBox="0 0 24 24" ${S}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.12 8.12L20 20M8.12 15.88L20 4"/></svg>`,
  razor: `<svg viewBox="0 0 24 24" ${S}><path d="M3 15l13-7 2 4-13 7z"/><path d="M16 8l4-2 1.5 3-3.5 3"/></svg>`,
  comb: `<svg viewBox="0 0 24 24" ${S}><rect x="3" y="5" width="18" height="6" rx="1.5"/><path d="M6 11v7M9 11v5M12 11v7M15 11v5M18 11v7"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" ${S}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  cup: `<svg viewBox="0 0 24 24" ${S}><path d="M4 9h12v5a5 5 0 01-5 5H9a5 5 0 01-5-5z"/><path d="M16 10.5h2a2 2 0 010 4h-2.5M8 3v2M12 3v2"/></svg>`,
  check: `<svg viewBox="0 0 24 24" ${S}><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24" ${S}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" ${S}><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" ${S}><path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
  leaf: `<svg viewBox="0 0 24 24" ${S}><path d="M5 19c0-8 5-14 15-14 0 9-5 15-13 15"/><path d="M5 19c3-5 6-8 10-10"/></svg>`,
  drop: `<svg viewBox="0 0 24 24" ${S}><path d="M12 3.5c3.2 4 6 7.1 6 10.6a6 6 0 01-12 0c0-3.5 2.8-6.6 6-10.6z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" ${S}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.9z"/></svg>`,
};

const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
}
const fmtPrice = (n) => `${Number(n).toLocaleString('ru-RU')} ₽`;
const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)} ч${m % 60 ? ` ${m % 60} мин` : ''}` : `${m} мин`);
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDateLong = (s) => parseDate(s).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDateShort = (s) => parseDate(s).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function mountIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ICONS[el.dataset.icon] || ''; }); // static trusted SVG
}

async function api(url, opts) {
  const res = await fetch(url, opts);
  let data = {};
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) { const e = new Error(data.error || 'Ошибка, попробуйте позже'); e.status = res.status; throw e; }
  return data;
}

/* ---------- UI chrome ---------- */
function initChrome() {
  const header = $('#header'), burger = $('#burger'), nav = $('#nav');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  const setNav = (open) => {
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  };
  burger.addEventListener('click', () => setNav(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });
}

/* ---------- static sections from config ---------- */
function renderShop(cfg) {
  const { shop } = cfg;
  const n = cfg.masters.length;
  document.title = `${window.__DEMO_LINK__ ? 'Демо: ' : ''}${shop.name} — онлайн-запись`; // a demo built from a link says so in the tab too
  const lead = shop.tagline ? `${shop.tagline}. ` : '';
  const md = $('meta[name=description]'); if (md) md.content = `${shop.name}. ${lead}${shop.address}. Онлайн-запись.`;
  document.querySelectorAll('[data-shop]').forEach((el) => { el.textContent = shop[el.dataset.shop] ?? ''; });
  $('#year').textContent = new Date().getFullYear();
  $('#hero-sub').textContent = `${lead}${n} ${plural(n, 'мастер', 'мастера', 'мастеров')}, ежедневно ${cfg.openTime}–${cfg.closeTime}. Выберите свободное время онлайн, без звонков.`;
  $('#ticket-hours').textContent = `Ежедневно ${cfg.openTime}–${cfg.closeTime}`;
  const tel = $('#c-phone'); tel.textContent = shop.phone; tel.href = `tel:${shop.phone.replace(/[^\d+]/g, '')}`;
  $('#c-hours').textContent = `Ежедневно, ${cfg.openTime}–${cfg.closeTime}`;
  const ig = $('#c-ig'), tg = $('#c-tg');
  shop.instagram ? (ig.href = shop.instagram) : ig.remove();
  shop.telegram ? (tg.href = shop.telegram) : tg.remove();
  // The map is a third-party page that sets cookies, so it is only fetched when the visitor asks for it.
  const q = encodeURIComponent(shop.mapQuery || shop.address);
  $('#map-link').href = `https://yandex.ru/maps/?text=${q}`;
  $('#map-show').onclick = () => {
    const f = h('iframe', { id: 'map', title: 'Карта', referrerpolicy: 'no-referrer-when-downgrade', src: `https://yandex.ru/map-widget/v1/?text=${q}&z=16` });
    $('#map-box').replaceChildren(f);
  };
}

function renderServices(cfg, onPick) {
  // A price board: the name, a leader line and the price on one row; the description, the duration and the button under it.
  $('#services-list').replaceChildren(...cfg.services.map((s) => h('li', {},
    h('div', { class: 'menu__row' }, h('h3', { text: s.name }), h('span', { class: 'leader', 'aria-hidden': 'true' }), h('span', { class: 'price', text: fmtPrice(s.price) })),
    h('div', { class: 'menu__sub' },
      h('p', { class: 'desc', text: s.description }),
      h('span', { class: 'dur', text: fmtDur(s.duration) }),
      h('button', { class: 'btn btn--secondary btn--sm', type: 'button', 'aria-label': `Выбрать: ${s.name}`, onclick: () => onPick({ service: s.id }), text: 'Выбрать' })))));
}

function renderMasters(cfg, onPick) {
  const svc = cfg.services[0];
  const cards = cfg.masters.map((m) => {
    const free = h('span', { class: 'free', hidden: true });
    const card = h('article', { class: `master${m.photo ? ' master--photo' : ''}` },
      m.photo ? h('img', { class: 'avatar avatar--photo', src: m.photo, alt: m.name, loading: 'lazy', decoding: 'async', width: '480', height: '600' })
        : h('div', { class: 'avatar', 'aria-hidden': 'true', text: m.name.trim().slice(0, 1).toUpperCase() }),
      h('div', { class: 'master__body' },
        h('h3', { text: m.name }),
        h('span', { class: 'role', text: m.role }),
        m.note ? h('p', { class: 'note', text: tie(m.note) }) : '',
        h('span', { class: 'exp', text: m.experience }),
        free,
        h('button', { class: 'btn btn--secondary btn--sm', type: 'button', 'aria-label': `Записаться, мастер ${m.name}`, onclick: () => onPick({ master: m.id }), text: 'Записаться' })));
    return { card, free, m };
  });
  $('#masters-grid').replaceChildren(...cards.map((c) => c.card));
  // The nearest free time of each master, today or tomorrow. A failed request just leaves the line out.
  for (const { free, m } of cards) {
    (async () => {
      for (const [i, date] of (cfg.dates || []).slice(0, 2).entries()) {
        const { slots } = await api(`/api/slots?${new URLSearchParams({ date, service: svc.id, master: m.id })}`);
        if (slots.length) { free.textContent = `${i === 0 ? 'Сегодня' : 'Завтра'} свободно в ${slots[0]}`; free.hidden = false; return; }
      }
    })().catch(() => {});
  }
}

// The texts, sections and colors of the page come from the preset (config.content). Everything is set with textContent.
// Russian typesetting: a one- to three-letter word is glued to the next one, so it never ends a line (the server does the same for the first paint).
const tie = (t) => String(t).replace(/(^|[\s(«])([А-Яа-яЁёA-Za-z]{1,3})\s+(?=\S)/g, '$1$2\u00a0');
const SECTION_IDS = ['services', 'statement', 'masters', 'works', 'why', 'reviews', 'faq', 'booking', 'contacts'];
// The sentence on the orange band: one span per word so the page can light the words up while it is scrolled (CSS, see themes.css).
// Without that CSS support, or with reduced motion, the spans are plain text.
function renderStatement(text) {
  const p = $('#statement-text'); if (!p) return;
  const words = tie(text ?? '').split(' ').filter(Boolean);
  p.style.setProperty('--n', words.length);
  p.replaceChildren(...words.flatMap((w, i) => [i ? ' ' : '', h('span', { text: w, style: `--i:${i}` })]));
}

// A strip of plain numbers taken from the shop's own settings, so it can never claim something the booking does not do.
function renderFacts(cfg) {
  const sec = $('#facts'), list = $('#facts-list'); if (!sec || !list) return;
  const prices = cfg.services.map((s) => s.price).filter((p) => p > 0);
  const n = cfg.masters.length;
  const facts = [
    prices.length ? [`от ${fmtPrice(Math.min(...prices))}`, 'самая доступная услуга, цена окончательная'] : null,
    [String(n), `${plural(n, 'мастер', 'мастера', 'мастеров')}, можно выбрать любого или ближайшего свободного`],
    [`${cfg.openTime}–${cfg.closeTime}`, 'ежедневно, запись на любое свободное время'],
    cfg.cancelBeforeMinutes ? [`за ${Math.round(cfg.cancelBeforeMinutes / 60)} ч`, 'можно отменить запись онлайн, без звонков'] : null,
  ].filter(Boolean);
  list.replaceChildren(...facts.map(([big, small]) => h('div', {}, h('dt', { text: big }), h('dd', { text: small }))));
  sec.hidden = false;
}

function renderContent(cfg) {
  const c = cfg.content || {};
  const set = (sel, text) => { const el = $(sel); if (el) el.textContent = tie(text ?? ''); };
  set('#hero-title', c.heroTitle); set('#hero-cta', c.heroCta); set('#hero-cta2', c.heroCta2);
  $('#faq-list').replaceChildren(...(c.faq || []).map((f) => h('details', {}, h('summary', { text: f.q }), h('p', { text: f.a }))));
  renderFacts(cfg);
  set('#closing-text', c.closing);
  renderStatement(c.statement);
  const concept = $('#hero-concept'); if (concept) { concept.textContent = tie(c.concept ?? ''); concept.hidden = !c.concept; }
  set('#services-lead', c.servicesLead); set('#masters-title', c.mastersTitle); set('#masters-lead', c.mastersLead);
  set('#why-title', c.visitTitle); set('#booking-lead', c.bookingLead);
  const mark = $('#logo-mark'); if (mark) mark.innerHTML = Object.hasOwn(ICONS, c.logoIcon) ? ICONS[c.logoIcon] : ICONS.scissors; // trusted SVG from the table above
  $('#why-list').replaceChildren(...(c.why || []).map((w) => {
    const ico = h('span', { class: 'ico' }); ico.innerHTML = Object.hasOwn(ICONS, w.icon) ? ICONS[w.icon] : '';
    return h('article', {}, ico, h('h3', { text: w.title }), h('p', { text: w.text }));
  }));
  $('#reviews-list').replaceChildren(...(c.reviews || []).map((r) => h('figure', { class: 'review' }, h('blockquote', { text: r.text }), h('figcaption', { text: r.name }))));
  document.documentElement.dataset.theme = c.theme || 'sign';
  // The browser bar follows the page. (The server fills this for the first paint; a demo that switches niche in the browser sets it here.)
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0f1113');
  renderArt(cfg);
  const a = c.accent;
  if (a && /^#[0-9a-f]{6}$/i.test(a.main) && /^#[0-9a-f]{6}$/i.test(a.text) && /^#[0-9a-f]{6}$/i.test(a.ink)) {
    const root = document.documentElement.style;
    root.setProperty('--brass', a.main); root.setProperty('--brass-text', a.text); root.setProperty('--brass-ink', a.ink);
  }
  // A section is shown only when the preset lists it and it has something to show.
  const listed = (id) => !c.sections || c.sections.includes(id);
  const whyPic = (cfg.gallery || []).length > 2 ? cfg.gallery.at(-1) : '';
  const wp = $('#why-photo'); if (wp) { wp.hidden = !whyPic; if (whyPic) wp.src = whyPic; }
  $('.why-wrap')?.classList.toggle('why-wrap--photo', !!whyPic);
  const filled = { faq: (c.faq || []).length > 0, statement: !!c.statement, why: (c.why || []).length > 0, reviews: (c.reviews || []).length > 0, works: (cfg.gallery || []).length > 1 };
  const closing = $('#closing'); if (closing) closing.hidden = !c.closing;
  for (const id of SECTION_IDS) {
    const show = listed(id) && (id in filled ? filled[id] : true);
    const sec = $(`#${id}`); if (sec) sec.hidden = !show;
    document.querySelectorAll(`a[data-nav="${id}"]`).forEach((link) => { link.hidden = !show || !(c.nav?.[id] ?? link.textContent); if (c.nav?.[id]) link.textContent = c.nav[id]; });
  }
}

// The first screen's picture: the client's own first photo when there is one, otherwise the niche's own graphic.
// A real photo is always better than the graphic, so the graphic is only a stand-in.
function renderArt(cfg) {
  const c = cfg.content || {}, art = $('#art'), photo = (cfg.gallery || [])[0], hero = $('.hero');
  // The barbershop look puts the photo behind the headline, edge to edge; the other looks keep it in a frame beside the text.
  hero.querySelector('.hero__bg')?.remove(); hero.classList.remove('hero--cover');
  if (photo && document.documentElement.dataset.theme === 'sign') {
    hero.classList.add('hero--cover'); art.hidden = true;
    return hero.prepend(h('img', { class: 'hero__bg', src: photo, alt: '', width: '1800', height: '1100', fetchpriority: 'high', decoding: 'async' }));
  }
  art.className = `art art--${photo ? 'photo' : (c.art || 'none')}`;
  art.hidden = !photo && (c.art || 'none') === 'none';
  if (photo) return art.replaceChildren(h('img', { src: photo, alt: '', width: '840', height: '1050', fetchpriority: 'high' }));
  const disc = h('span', { class: 'art__disc' }); disc.innerHTML = Object.hasOwn(ICONS, c.logoIcon) ? ICONS[c.logoIcon] : ICONS.scissors;
  art.replaceChildren(...(c.art === 'swatches' ? ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => h('span', { class: `drop drop--${k}` })) : [disc]));
}

function renderGallery(cfg) {
  // The first photo already stands beside the headline; the grid shows the rest.
  const photos = (cfg.gallery || []).slice(1);
  $('#works-grid').replaceChildren(...photos.map((src, i) => h('img', { src, alt: `Работа мастера, фото ${i + 1}`, loading: 'lazy', decoding: 'async' })));
}

// Hero card: the nearest real free times for the first service, today or tomorrow.
async function renderTicket(cfg, onPick) {
  const svc = cfg.services[0];
  const box = $('#ticket-slots');
  $('#ticket-svc').textContent = `${svc.name} · ${fmtDur(svc.duration)} · ${fmtPrice(svc.price)}`;
  box.replaceChildren(h('p', {}, h('span', { class: 'spin', 'aria-hidden': 'true' }), 'Проверяем расписание…'));
  for (const [i, date] of cfg.dates.slice(0, 2).entries()) {
    let slots = [];
    try { ({ slots } = await api(`/api/slots?${new URLSearchParams({ date, service: svc.id, master: 'any' })}`)); }
    catch {
      $('#ticket-date').textContent = '';
      box.replaceChildren(h('p', {}, 'Не удалось загрузить расписание. ', h('a', { href: '#booking', text: 'Перейти к записи' })));
      return;
    }
    if (!slots.length) continue;
    $('#ticket-title').textContent = i === 0 ? 'Свободно сегодня' : 'Свободно завтра';
    $('#ticket-date').textContent = fmtDateShort(date);
    box.replaceChildren(...slots.slice(0, 8).map((t) => h('button', {
      type: 'button', class: 'slot', 'aria-label': `${svc.name}, ${fmtDateLong(date)}, ${t}`,
      onclick: () => onPick({ service: svc.id, master: 'any', date, time: t }),
    }, t)));
    return;
  }
  $('#ticket-date').textContent = '';
  box.replaceChildren(h('p', {}, 'На ближайшие дни всё занято. ', h('a', { href: '#booking', text: 'Посмотреть другие даты' })));
}

/* ---------- booking widget ---------- */
function formatPhone(raw) {
  let d = raw.replace(/\D/g, '');
  if (d[0] === '7' || d[0] === '8') d = d.slice(1);
  d = d.slice(0, 10);
  if (!d.length) return '';
  // The bracket is added only once a 4th digit exists, so Backspace can delete back into the area code.
  let out = '+7 (' + d.slice(0, 3);
  if (d.length > 3) out += ') ' + d.slice(3, 6);
  if (d.length > 6) out += '-' + d.slice(6, 8);
  if (d.length > 8) out += '-' + d.slice(8, 10);
  return out;
}
const phoneDigits = (v) => v.replace(/\D/g, '').replace(/^[78]/, '');

function initBooking(cfg) {
  const root = $('#booking-root');
  const st = { service: null, master: 'any', date: cfg.dates[0], time: null, slots: null, loading: false, name: '', phone: '', comment: '', consent: false, submitting: false, error: '' };
  const svc = () => cfg.services.find((s) => s.id === st.service);
  const mst = () => (st.master === 'any' ? null : cfg.masters.find((m) => m.id === st.master));
  let reqId = 0;

  async function loadSlots() {
    st.time = null;
    if (!st.service) { st.slots = null; st.loading = false; paintSlots(); paintSummary(); return; }
    const my = ++reqId;
    st.loading = true; st.slots = null; paintSlots(); paintSummary();
    try {
      const q = new URLSearchParams({ date: st.date, service: st.service, master: st.master });
      const data = await api(`/api/slots?${q}`);
      if (my !== reqId) return;
      st.slots = data.slots;
    } catch (e) {
      if (my !== reqId) return;
      st.slots = []; st.error = e.message;
    }
    st.loading = false; paintSlots(); paintSummary();
  }

  /* skeleton built once */
  const refs = {};
  const stepTitle = (n, t) => [h('span', { class: 'step__n', 'aria-hidden': 'true', text: String(n) }), t];
  refs.services = h('div', { class: 'opts' });
  refs.masters = h('div', { class: 'opts' });
  refs.dates = h('div', { class: 'dates', role: 'group', 'aria-label': 'Дата' });
  refs.slots = h('div', { class: 'slots', 'aria-live': 'polite' });
  refs.name = h('input', { id: 'f-name', type: 'text', autocomplete: 'name', maxlength: '60', required: true, placeholder: 'Как к вам обращаться' });
  refs.phone = h('input', { id: 'f-phone', type: 'tel', inputmode: 'tel', autocomplete: 'tel', required: true, placeholder: '+7 (___) ___-__-__' });
  refs.comment = h('textarea', { id: 'f-comment', maxlength: '500', placeholder: 'Например, хочу оставить длину сверху' });
  refs.consent = h('input', { id: 'f-consent', type: 'checkbox', required: true });
  refs.consent.addEventListener('change', () => { st.consent = refs.consent.checked; paintSummary(); });
  refs.sum = h('dl');
  refs.err = h('p', { class: 'err', role: 'alert', 'aria-live': 'assertive' });
  refs.submit = h('button', { class: 'btn btn--primary submit', type: 'submit', text: 'Записаться' });

  refs.name.addEventListener('input', () => { st.name = refs.name.value; paintSummary(); });
  refs.phone.addEventListener('input', () => { refs.phone.value = formatPhone(refs.phone.value); st.phone = refs.phone.value; paintSummary(); });
  refs.phone.addEventListener('focus', () => { if (!refs.phone.value) { refs.phone.value = '+7 ('; } const n = refs.phone.value.length; setTimeout(() => refs.phone.setSelectionRange(n, n), 0); });
  refs.phone.addEventListener('blur', () => { if (phoneDigits(refs.phone.value).length === 0) { refs.phone.value = ''; st.phone = ''; } });
  refs.comment.addEventListener('input', () => { st.comment = refs.comment.value; });

  const fs = (n, title, ...body) => h('fieldset', { class: 'step' }, h('legend', {}, stepTitle(n, title)), ...body);
  const form = h('form', { novalidate: true, onsubmit: submit },
    fs(1, 'Услуга', refs.services),
    fs(2, 'Мастер', refs.masters),
    fs(3, 'Дата', refs.dates),
    fs(4, 'Время', refs.slots),
    fs(5, 'Контакты', h('div', { class: 'fields' },
      h('div', { class: 'field' }, h('label', { for: 'f-name', text: 'Имя' }), refs.name),
      h('div', { class: 'field' }, h('label', { for: 'f-phone', text: 'Телефон' }), refs.phone),
      h('div', { class: 'field field--full' }, h('label', { for: 'f-comment', text: 'Комментарий для мастера' }), refs.comment))),
    fs(6, 'Ваша запись', h('div', { class: 'summary' }, refs.sum), refs.err,
      h('div', { class: 'consent' }, refs.consent, h('label', { for: 'f-consent' }, 'Я даю ', h('a', { href: 'consent.html', target: '_blank', rel: 'noopener', text: 'согласие на обработку персональных данных' }), ' (', h('a', { href: 'privacy.html', target: '_blank', rel: 'noopener', text: 'политика конфиденциальности' }), ')')),
      refs.submit));
  root.replaceChildren(form);
  root.removeAttribute('aria-busy');

  function paintServices() {
    refs.services.replaceChildren(...cfg.services.map((s) => h('button', {
      type: 'button', class: 'opt', 'aria-pressed': String(st.service === s.id),
      onclick: () => { st.service = s.id; st.error = ''; paintServices(); loadSlots(); },
    }, h('b', { text: s.name }), h('small', { text: `${fmtPrice(s.price)} · ${fmtDur(s.duration)}` }))));
  }
  function paintMasters() {
    const opt = (id, name, sub) => h('button', {
      type: 'button', class: 'opt', 'aria-pressed': String(st.master === id),
      onclick: () => { st.master = id; st.error = ''; paintMasters(); loadSlots(); },
    }, h('b', { text: name }), h('small', { text: sub }));
    refs.masters.replaceChildren(opt('any', 'Любой мастер', 'Ближайшее свободное время'), ...cfg.masters.map((m) => opt(m.id, m.name, m.role)));
  }
  function paintDates() {
    const today = cfg.dates[0];
    refs.dates.replaceChildren(...cfg.dates.map((d) => {
      const dt = parseDate(d);
      const wd = d === today ? 'Сег' : cap(dt.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', ''));
      return h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(st.date === d),
        'aria-label': `${wd} ${dt.getDate()}, ${fmtDateLong(d)}`,
        onclick: () => { st.date = d; st.error = ''; paintDates(); loadSlots(); },
      }, h('span', { text: wd }), ' ', h('b', { text: String(dt.getDate()) }));
    }));
    // Only the strip of dates scrolls sideways to the chosen day. scrollIntoView would also move the whole page.
    const on = refs.dates.querySelector('[aria-pressed=true]');
    if (on) refs.dates.scrollLeft = Math.max(0, on.offsetLeft - (refs.dates.clientWidth - on.offsetWidth) / 2);
  }
  function paintSlots() {
    if (!st.service) refs.slots.replaceChildren(h('p', { class: 'status', text: 'Сначала выберите услугу' }));
    else if (st.loading) refs.slots.replaceChildren(h('p', { class: 'status' }, h('span', { class: 'spin', 'aria-hidden': 'true' }), 'Загружаем свободное время…'));
    else if (!st.slots || !st.slots.length) refs.slots.replaceChildren(h('p', { class: 'status', text: 'На этот день свободного времени нет. Выберите другую дату или другого мастера.' }));
    else refs.slots.replaceChildren(...st.slots.map((t) => h('button', {
      type: 'button', class: 'slot', 'aria-pressed': String(st.time === t),
      onclick: () => { st.time = t; st.error = ''; paintSlots(); paintSummary(); },
    }, t)));
  }
  const valid = () => st.service && st.date && st.time && st.name.trim().length >= 2 && phoneDigits(st.phone).length === 10 && st.consent;
  function row(dt, dd, cls) { return [h('dt', { text: dt }), h('dd', { class: cls, text: dd })]; }
  function paintSummary() {
    const s = svc();
    refs.sum.replaceChildren(
      ...row('Услуга', s ? s.name : '—'),
      ...row('Мастер', mst() ? mst().name : 'Любой мастер'),
      ...row('Дата', st.date ? fmtDateLong(st.date) : '—'),
      ...row('Время', st.time || '—'),
      ...row('Итого', s ? fmtPrice(s.price) : '—', 'total'));
    refs.err.textContent = st.error;
    refs.submit.disabled = !valid() || st.submitting;
    refs.submit.textContent = st.submitting ? 'Отправляем…' : 'Записаться';
  }

  async function submit(e) {
    e.preventDefault();
    if (!valid() || st.submitting) return;
    st.submitting = true; st.error = ''; paintSummary();
    try {
      const r = await api('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: st.name.trim(), phone: st.phone, serviceId: st.service, masterId: st.master, date: st.date, time: st.time, comment: st.comment.trim(), price: svc().price, consent: true }),
      });
      showDone(r);
    } catch (err) {
      st.submitting = false; st.error = err.message; paintSummary();
      if (err.status === 409) loadSlots().then(() => { st.error = err.message; paintSummary(); });
      else if (err.status === 400) checkStale();
    }
  }

  // The owner may have removed a service or master or changed prices while this page was open.
  async function checkStale() {
    try {
      const fresh = await api('/api/config');
      const s = svc(), fs2 = fresh.services.find((x) => x.id === st.service);
      const masterGone = st.master !== 'any' && !fresh.masters.some((m) => m.id === st.master);
      if (!fs2 || masterGone || fs2.price !== s.price || fs2.duration !== s.duration) {
        st.error = 'Услуги или цены на сайте обновились. Обновите страницу, чтобы записаться по актуальному прайсу.';
        paintSummary();
        refs.err.append(' ', h('button', { type: 'button', class: 'linkbtn', text: 'Обновить', onclick: () => location.reload() }));
      }
    } catch { /* keep the original error */ }
  }

  function showDone(r) {
    const ico = h('div', { class: 'done__ico', 'aria-hidden': 'true' });
    ico.innerHTML = ICONS.check;
    const card = h('div', { class: 'done', role: 'status' },
      ico,
      h('h3', { text: 'Вы записаны' }),
      h('p', { text: 'Ждём вас. Если планы изменятся, позвоните нам, и мы перенесём запись.' }),
      h('div', { class: 'summary' }, h('dl', {},
        ...row('Услуга', r.service), ...row('Мастер', r.master),
        ...row('Дата', fmtDateLong(r.date)), ...row('Время', r.time), ...row('Итого', fmtPrice(r.price), 'total'))),
      r.manageUrl ? h('p', { class: 'muted' }, h('a', { href: r.manageUrl, text: 'Добавить в календарь или отменить запись' }), ' Сохраните эту ссылку: другого способа вернуться к записи нет.') : null,
      r.manageUrl && cfg.reminderBot ? h('a', { class: 'btn btn--secondary', target: '_blank', rel: 'noopener', href: `https://t.me/${cfg.reminderBot}?start=r_${r.manageUrl.split('=')[1]}`, text: 'Напомнить в Telegram' }) : null,
      h('button', { class: 'btn btn--secondary', type: 'button', text: 'Записаться ещё', onclick: reset }));
    root.replaceChildren(card);
    card.setAttribute('tabindex', '-1'); card.focus({ preventScroll: true });
    root.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function reset() { widget = initBooking(cfg); root.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  paintServices(); paintMasters(); paintDates(); paintSlots(); paintSummary();

  return {
    // Preselect from anywhere on the page: a service card, a master card or a hero time slot.
    async pick({ service, master, date, time }) {
      if (service) st.service = service;
      if (master) st.master = master;
      if (date) st.date = date;
      st.error = '';
      paintServices(); paintMasters(); paintDates();
      document.getElementById('booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
      await loadSlots();
      if (time && st.slots?.includes(time)) { st.time = time; paintSlots(); paintSummary(); }
    },
  };
}

/* ---------- boot ---------- */
let widget;
async function main() {
  mountIcons(); initChrome();
  let cfg;
  try { cfg = await api('/api/config'); }
  catch (e) {
    $('#booking-root').replaceChildren(h('p', { class: 'err', role: 'alert', text: 'Не удалось загрузить данные. Обновите страницу.' }));
    return;
  }
  const pick = (sel) => widget && widget.pick(sel);
  renderShop(cfg);
  renderContent(cfg);
  renderServices(cfg, pick);
  renderMasters(cfg, pick);
  renderGallery(cfg);
  widget = initBooking(cfg);
  renderTicket(cfg, pick);
  // A tab left open past midnight would offer yesterday's dates; reload when the shop's day has changed.
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    try { const fresh = await api('/api/config'); if (fresh.dates[0] !== cfg.dates[0]) location.reload(); } catch { /* keep the page */ }
  });
}
main();

/* ---------- two small movements: the ticket follows the pointer, a booking button follows the phone user ---------- */
(() => {
  const fine = matchMedia('(hover: hover) and (pointer: fine)'), calm = matchMedia('(prefers-reduced-motion: reduce)');
  const hero = document.querySelector('.hero'), ticket = document.querySelector('.ticket');
  if (hero && ticket && fine.matches && !calm.matches) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      ticket.style.setProperty('--tx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      ticket.style.setProperty('--ty', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { ticket.style.setProperty('--tx', 0); ticket.style.setProperty('--ty', 0); });
  }
  // The floating button appears once the first screen is behind the visitor and disappears while the form itself is on screen.
  const fab = document.getElementById('fab'), booking = document.getElementById('booking');
  if (fab && hero && booking && 'IntersectionObserver' in window) {
    const seen = new Map([[hero, true], [booking, false]]);
    const io = new IntersectionObserver((es) => {
      for (const e of es) seen.set(e.target, e.isIntersecting);
      fab.classList.toggle('fab--on', !seen.get(hero) && !seen.get(booking));
    });
    io.observe(hero); io.observe(booking);
  }
})();
