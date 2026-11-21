// The landing page as a pure function: profile in, HTML text out. No files, no network, so the same code runs in Node
// (scripts/make-landing.mjs) and in the browser (landing/make.html). Photos are resolved by a callback the caller gives.
// A look ("night", "blush") sets colours and type; the profile may override any colour. Text is escaped, nothing is run.
// Same typesetting rule as shell.js (a short word is glued to the next one); kept here so this file has no imports.
const tie = (text) => String(text).replace(/(^|[\s(«])([А-Яа-яЁёA-Za-z]{1,3})\s+(?=\S)/g, '$1$2\u00a0').replace(/\s+([—–-])\s/g, '\u00a0$1 ');
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = /^#[0-9a-f]{6}$/i;
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const rub = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}\u00a0₽`;
const mm = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

// Two looks. Each is a complete set of colours and type; nothing here is specific to one business.
export const LOOKS = {
  night: { // dark green-black, ivory paper, one copper accent, slab letters
    c: { bg: '#0f1c17', deep: '#0a1511', card: '#172a23', text: '#eee6d2', muted: '#9fada5', accent: '#e0642b', accentInk: '#1a0e07', accentText: '#ff9a62', accentDeep: '#b4491a', paper: '#eee6d2', ink: '#12201b', ink2: '#4d4f43', sage: '#8aa596' },
    type: { display: "'Podkova',Georgia,serif", logo: "800 20px/1 'Podkova',Georgia,serif", tag: "700 15px/1.2 'Podkova',Georgia,serif", h1: "800 clamp(40px,5.4vw,82px)/1 'Podkova',Georgia,serif", h2: "700 clamp(32px,4.4vw,60px)/1.06 'Podkova',Georgia,serif", h3: "700 24px/1.15 'Podkova',Georgia,serif", price: "800 26px/1 'Podkova',Georgia,serif", strip: "700 clamp(28px,4.6vw,64px)/1 'Podkova',Georgia,serif", caption: "italic 600 22px/1.1 'Cormorant Garamond',Georgia,serif", case: 'uppercase', h1Track: '.005em', h2Track: '0', r: '3px', rCtl: '5px', rCard: '8px' },
    ornament: true,
  },
  blush: { // pale and airy, plum ink, dusty rose, high-contrast serif
    c: { bg: '#f7f5f9', deep: '#2b1a35', card: '#ffffff', text: '#241a2c', muted: '#6a5d74', accent: '#a83f69', accentInk: '#ffffff', accentText: '#a83f69', accentDeep: '#a83f69', paper: '#ffffff', ink: '#241a2c', ink2: '#5a4d63', sage: '#e9c7d5' },
    type: { display: "'Cormorant Garamond',Georgia,serif", logo: "700 28px/1 'Cormorant Garamond',Georgia,serif", tag: "700 16px/1.2 'Cormorant Garamond',Georgia,serif", h1: "600 clamp(48px,6.6vw,96px)/.98 'Cormorant Garamond',Georgia,serif", h2: "600 clamp(38px,5vw,68px)/1 'Cormorant Garamond',Georgia,serif", h3: "600 28px/1.1 'Cormorant Garamond',Georgia,serif", price: "600 30px/1 'Cormorant Garamond',Georgia,serif", strip: "600 clamp(32px,5vw,72px)/1 'Cormorant Garamond',Georgia,serif", caption: "italic 600 22px/1.1 'Cormorant Garamond',Georgia,serif", case: 'none', h1Track: '-.015em', h2Track: '-.01em', r: '12px', rCtl: '999px', rCard: '28px' },
    ornament: false,
    light: true, // the page itself is light, the first screen and the loud band are still dark / accent
  },
};

function ornamentTile(c) {
  const cols = [c.accent, c.paper, c.sage, c.paper]; const W = 112, H = 22, sw = 28; let p = '';
  cols.forEach((col, i) => { const a = i * sw; for (const o of [0, -W]) p += `<polygon fill="${col}" points="${a + H + o},0 ${a + H + sw + o},0 ${a + sw + o},${H} ${a + o},${H}"/>`; });
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>${p}</svg>`).replace(/'/g, '%27')}")`;
}

export const HERO_VARIANTS = ['split', 'phone', 'center', 'type'];

export function validate(p) {
  const need = (cond, msg) => { if (!cond) throw new Error(`Профиль: ${msg}`); };
  need(p && typeof p === 'object', 'нужен объект');
  need(p.name && String(p.name).length <= 60, 'название до 60 знаков');
  need(LOOKS[p.look || 'night'], `неизвестный вид «${p.look}», есть: ${Object.keys(LOOKS).join(', ')}`);
  need(Array.isArray(p.hours) && /^\d\d:\d\d$/.test(p.hours[0]) && /^\d\d:\d\d$/.test(p.hours[1]) && mm(p.hours[1]) - mm(p.hours[0]) >= 120, 'часы работы ["10:00","21:00"], не меньше двух часов');
  need(Array.isArray(p.services) && p.services.length >= 1 && p.services.length <= 12, 'от 1 до 12 услуг');
  for (const s of p.services) need(s.name && Number.isFinite(s.price) && s.price >= 0 && Number.isFinite(s.duration) && s.duration >= 15, `услуга «${s.name}»: название, цена, длительность от 15 минут`);
  need(p.hero && p.hero.title, 'hero.title');
  need(HERO_VARIANTS.includes(p.hero.variant || 'split'), `hero.variant: один из ${HERO_VARIANTS.join(', ')}`);
  need(p.hero.photo || ['phone', 'center', 'type'].includes(p.hero.variant || 'split'), 'hero.photo нужен для варианта split');
  for (const k of Object.keys(p.colors || {})) need(hex.test(p.colors[k]), `цвет ${k} в формате #rrggbb`);
  return p;
}

export function renderLanding(profile, photoUrl) {
  const p = validate(profile); const look = LOOKS[p.look || 'night'];
  const c = { ...look.c, ...(p.colors || {}) };
  // The text on the accent must be readable: the generator refuses a colour pair that is not, instead of shipping it.
  if (contrast(c.accent, c.accentInk) < 4.5) throw new Error(`Профиль: текст ${c.accentInk} на акценте ${c.accent} читается плохо (${contrast(c.accent, c.accentInk).toFixed(2)}:1, нужно 4.5)`);
  const t = look.type;
  const vars = {
    '--bg': c.bg, '--deep': c.deep, '--deep-rgb': rgb(c.deep), '--card': c.card, '--text': c.text, '--text-rgb': rgb(c.text), '--muted': c.muted,
    '--line2': `rgb(${rgb(c.text)} / .26)`, '--head': `rgb(${rgb(c.deep)} / .94)`,
    '--accent': c.accent, '--accent-ink': c.accentInk, '--accent-text': c.accentText, '--accent-hover': c.accent, '--accent-deep': c.accentDeep,
    '--paper': c.paper, '--ink': c.ink, '--ink2': c.ink2, '--ink-rgb': rgb(c.ink), '--ink-line': `rgb(${rgb(c.ink)} / .2)`,
    '--display': t.display, '--ui': "'Golos Text',system-ui,-apple-system,'Segoe UI',sans-serif", '--logo': t.logo, '--tag': t.tag, '--h1': t.h1, '--h2': t.h2, '--h3': t.h3, '--price': t.price, '--strip': t.strip, '--caption': t.caption,
    '--case': t.case, '--h1-track': t.h1Track, '--h2-track': t.h2Track, '--r': t.r, '--r-ctl': t.rCtl, '--r-card': t.rCard, '--ease': 'cubic-bezier(.23,1,.32,1)',
    '--ornament': look.ornament ? ornamentTile(c) : 'none', '--focus': p.hero.focus || '60% 40%',
  };
  // On a light look the page body is light but the dark parts (first screen, strip text) keep light text: those are set per block below.
  const light = Boolean(look.light);
  const photo = (src) => photoUrl(String(src));

  const open = mm(p.hours[0]); const step = 30; const first = open + 60;
  const taken = new Set(p.takenSlots || [2, 5]);
  const slots = Array.from({ length: 8 }, (_, i) => hhmm(first + i * step)).map((s, i) => `<button type="button" class="slot" style="--i:${i}" aria-pressed="false"${taken.has(i) ? ' disabled' : ''}>${s}</button>`).join('');
  const svc0 = p.services[0];
  const lines = String(p.hero.title).split('\n').map((l) => `<span class="l">${esc(tie(l))}</span>`).join('');
  const words = tie(p.statement || '').split(' ').filter(Boolean);
  const statement = words.map((w, i) => `${i ? ' ' : ''}<span style="--i:${i}">${esc(w)}</span>`).join('');
  const strip = [...p.services.map((s) => s.name), ...p.services.map((s) => s.name)].map((n) => `<span>${esc(n)}</span>`).join('');
  const menu = p.services.map((s) => `<li><div class="row"><h3>${esc(s.name)}</h3><i class="dots"></i><span class="price">${rub(s.price)}</span></div>${s.desc ? `<p>${esc(s.desc)}</p>` : '<span></span>'}<span class="dur">${s.duration >= 60 ? `${Math.floor(s.duration / 60)}\u00a0ч${s.duration % 60 ? ` ${s.duration % 60}\u00a0мин` : ''}` : `${s.duration}\u00a0мин`}</span></li>`).join('');
  const gallery = (p.gallery || []).slice(0, 7).map((g, i) => `<figure><img src="${photo(g.src)}" alt="${esc(g.alt || g.caption || '')}" loading="${i ? 'lazy' : 'eager'}" decoding="async"><figcaption>${esc(g.caption || '')}</figcaption></figure>`).join('');
  const tel = String(p.phone || '').replace(/[^\d+]/g, '');
  const cta = p.cta || 'Записаться онлайн';
  const variant = p.hero.variant || 'split';
  const heroPhoto = p.hero.photo ? photo(p.hero.photo) : '';
  const title = `${p.name}${p.tagline ? ` — ${p.tagline}` : ''}`;

  const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)}\u00a0ч${m % 60 ? ` ${m % 60}\u00a0мин` : ''}` : `${m}\u00a0мин`);
  const free = Array.from({ length: 8 }, (_, i) => hhmm(first + i * step)).filter((_, i) => !taken.has(i)).slice(0, 3);
  const card = `<aside class="card" aria-labelledby="card-t">
      <h2 id="card-t">Свободное время</h2>
      <p class="card__meta"><span>${esc(svc0.name)}\u00a0· ${dur(svc0.duration)}</span><span>${rub(svc0.price)}</span></p>
      <div class="slots" role="group" aria-label="Время">${slots}</div>
      <a class="btn btn--main" id="card-cta" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}" data-base="${esc(cta)}">${esc(cta)}</a>
      <p class="card__meta" style="margin:12px 0 0;font-size:13px"><span>Макет: время показано для примера</span></p>
    </aside>`;
  // A phone with the booking assistant's conversation. The words come from the profile (hero.chat) or are built from its own services and free times.
  const chat = p.hero.chat || [
    ['in', 'Здравствуйте! Есть время сегодня?'],
    ['out', `Да. Сегодня свободно в ${free.join(', ')}. На какую услугу записать?`],
    ['in', svc0.name],
    ['out', `${svc0.name}, ${dur(svc0.duration)}, ${rub(svc0.price)}. Записал вас на ${free[0]}. Напомню за два часа.`],
  ];
  const phone = `<div class="phone" role="img" aria-label="Пример переписки с помощником записи">
      <div class="phone__bar"><i></i><span translate="no">${esc(p.name)}</span></div>
      <div class="phone__chat">${chat.map(([who, t], i) => `<p class="msg msg--${who === 'in' ? 'in' : 'out'}" style="--i:${i}">${esc(t)}</p>`).join('')}</div>
      <div class="phone__field"><span>Сообщение</span></div>
      <p class="phone__note">Макет: переписка показана для примера</p>
    </div>`;

  const html = `<!doctype html>
<html lang="ru"${light ? ' data-look="light"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="${esc(c.deep)}">
<title>${esc(title)}</title>
${heroPhoto ? `<link rel="preload" as="image" href="${heroPhoto}">` : ''}
<link rel="stylesheet" href="assets/fonts.css">
<link rel="stylesheet" href="assets/landing.css">
<style>:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}${light ? 'body{background:var(--bg);color:var(--text)}.head{color:#fff}.hero{color:#fff}.hero__sub{color:#fff}.btn--ghost{color:#fff;border-color:rgb(255 255 255/.45)}.strip{border-color:var(--ink)}.strip__row{color:var(--ink)}' : ''}</style>
</head>
<body>
<header class="head" id="head"><div class="wrap head__in">
  <a class="logo" href="#top" translate="no">${esc(p.name)}</a>
  <nav aria-label="Разделы"><a href="#price">Цены</a>${gallery ? '<a href="#works">Работы</a>' : ''}<a href="#contacts">Контакты</a><a class="btn btn--main" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}">Записаться</a></nav>
</div></header>
<main id="top">
<section class="hero hero--${variant}" id="book">
  ${heroPhoto && ['split', 'center'].includes(variant) ? `<img class="hero__bg" src="${heroPhoto}" alt="" width="1800" height="1100" fetchpriority="high">` : ''}
  <div class="hero__in">
    <div class="hero__text">
      ${p.hero.concept ? `<p class="tag">${esc(tie(p.hero.concept))}</p>` : ''}
      <h1>${lines}</h1>
      ${p.hero.sub ? `<p class="hero__sub">${esc(tie(p.hero.sub))}</p>` : ''}
      <div class="hero__cta"><a class="btn btn--main" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}">${esc(cta)}</a><a class="btn btn--ghost" href="tel:${esc(tel)}">${esc(p.phone || 'Позвонить')}</a></div>
    </div>
    ${variant === 'phone' ? phone : card}
  </div>
  ${look.ornament ? '<div class="ornament" aria-hidden="true"><i></i></div>' : ''}
</section>
<div class="strip" aria-hidden="true"><div class="strip__row">${strip}</div></div>
<section class="sec paper" id="price"><div class="wrap split">
  <div><h2 class="big">Услуги и цены</h2><p class="lead">${esc(p.priceLead || 'Цена окончательная, без доплат на месте.')}</p></div>
  <ul class="menu">${menu}</ul>
</div></section>
${gallery ? `<section class="sec" id="works"><div class="wrap"><h2 class="big">${esc(p.worksTitle || 'Работы')}</h2><div class="works">${gallery}</div></div></section>` : ''}
${statement ? `<section class="say"><div class="wrap"><p style="--n:${words.length}">${statement}</p></div></section>` : ''}
<section class="sec paper" id="contacts"><div class="wrap end">
  <div><h2>${esc(tie(p.closing || 'Выберите время, остальное мы берём на себя.'))}</h2><a class="btn btn--main" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}">${esc(cta)}</a></div>
  <dl class="facts">
    ${p.address ? `<div><dt>Адрес</dt><dd>${esc(p.address)}</dd></div>` : ''}
    ${p.phone ? `<div><dt>Телефон</dt><dd><a href="tel:${esc(tel)}">${esc(p.phone)}</a></dd></div>` : ''}
    <div><dt>Часы</dt><dd>Ежедневно, ${esc(p.hours[0])}–${esc(p.hours[1])}</dd></div>
  </dl>
</div></section>
</main>
<footer class="foot"><div class="wrap"><span translate="no">© ${esc(p.name)}</span><span>Макет сайта, не окончательная версия</span></div></footer>
<dialog class="book" id="book-dialog" aria-labelledby="book-t">
  <form method="dialog" class="book__form" id="book-form" novalidate>
    <button type="button" class="book__x" id="book-x" aria-label="Закрыть">×</button>
    <h2 id="book-t">Запись</h2>
    <label>Услуга<select name="svc" id="book-svc">${p.services.map((sv, i) => `<option value="${i}">${esc(sv.name)}, ${rub(sv.price)}</option>`).join('')}</select></label>
    <label>Время<select name="time" id="book-time">${Array.from({ length: 8 }, (_, i) => hhmm(first + i * step)).map((t, i) => `<option value="${t}"${taken.has(i) ? ' disabled' : ''}>Сегодня, ${t}${taken.has(i) ? ' (занято)' : ''}</option>`).join('')}</select></label>
    <label>Имя<input name="name" id="book-name" autocomplete="name" maxlength="60" placeholder="Как к вам обращаться"></label>
    <label>Телефон<input name="phone" id="book-phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="30" placeholder="+7 900 000-00-00"></label>
    <p class="book__err" id="book-err" role="alert"></p>
    <button type="submit" class="btn btn--main">Записаться</button>
    <p class="book__note">Макет: заявка никуда не отправляется. В готовом сайте она сразу приходит администратору.</p>
  </form>
  <div class="book__done" id="book-done" hidden>
    <h2>Готово (макет)</h2>
    <p id="book-sum"></p>
    ${p.bookingUrl ? `<p><a class="btn btn--ghost" href="${esc(p.bookingUrl)}" target="_blank" rel="noopener">Посмотреть настоящую запись</a></p>` : ''}
    <button type="button" class="btn btn--main" id="book-close">Закрыть</button>
  </div>
</dialog>
<script>
(function () {
  var head = document.getElementById('head');
  var solid = function () { head.classList.toggle('is-solid', window.scrollY > 40); };
  solid(); window.addEventListener('scroll', solid, { passive: true });
  var cta = document.getElementById('card-cta'), buttons = document.querySelectorAll('.slot');
  buttons.forEach(function (b) { b.addEventListener('click', function () {
    buttons.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    cta.textContent = cta.dataset.base + ' на ' + b.textContent;
  }); });
  // Every "book" button opens the same small window. Without scripts the link still works (phone or the full booking page).
  var dlg = document.getElementById('book-dialog'), form = document.getElementById('book-form'), done = document.getElementById('book-done');
  var err = document.getElementById('book-err'), timeSel = document.getElementById('book-time');
  if (dlg && typeof dlg.showModal === 'function') {
    var reset = function () { form.hidden = false; done.hidden = true; err.textContent = ''; };
    document.querySelectorAll('[data-book]').forEach(function (a) { a.addEventListener('click', function (e) {
      e.preventDefault(); reset();
      var picked = document.querySelector('.slot[aria-pressed=true]'); if (picked) timeSel.value = picked.textContent;
      dlg.showModal(); document.getElementById('book-name').focus();
    }); });
    var close = function () { dlg.close(); };
    document.getElementById('book-x').addEventListener('click', close);
    document.getElementById('book-close').addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('book-name').value.trim(), phone = document.getElementById('book-phone').value;
      var digits = phone.replace(/\\D/g, '').length;
      if (name.length < 2) { err.textContent = 'Введите имя'; return; }
      if (digits < 10 || digits > 15) { err.textContent = 'Проверьте телефон: от 10 до 15 цифр'; return; }
      var svc = document.getElementById('book-svc'), label = svc.options[svc.selectedIndex].text;
      document.getElementById('book-sum').textContent = name + ', ' + label + ', сегодня в ' + timeSel.value + '. Так выглядит подтверждение; на настоящем сайте оно приходит сразу и с напоминанием.';
      form.hidden = true; done.hidden = false;
    });
  }
})();
</script>
</body>
</html>
`;
  return html;
}
