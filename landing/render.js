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
const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
const hhmm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

// Two looks. Each is a complete set of colours and type; nothing here is specific to one business.
export const LOOKS = {
  night: { // dark green-black, ivory paper, one copper accent, slab letters
    c: { bg: '#0f1c17', deep: '#0a1511', card: '#172a23', text: '#eee6d2', muted: '#9fada5', accent: '#e0642b', accentInk: '#1a0e07', accentText: '#ff9a62', accentDeep: '#b4491a', paper: '#eee6d2', ink: '#12201b', ink2: '#4d4f43', sage: '#8aa596' },
    type: { display: "'Podkova',Georgia,serif", logo: "800 20px/1 'Podkova',Georgia,serif", tag: "700 15px/1.2 'Podkova',Georgia,serif", h1: "800 clamp(40px,5.4vw,82px)/1 'Podkova',Georgia,serif", h2: "700 clamp(32px,4.4vw,60px)/1.06 'Podkova',Georgia,serif", h3: "700 24px/1.15 'Podkova',Georgia,serif", price: "800 26px/1 'Podkova',Georgia,serif", strip: "700 clamp(28px,4.6vw,64px)/1 'Podkova',Georgia,serif", caption: "italic 600 22px/1.1 'Cormorant Garamond',Georgia,serif", case: 'uppercase', h1Track: '.005em', h2Track: '0', r: '3px', rCtl: '5px', rCard: '8px' },
    ornament: true,
    grade: 'sepia(.14) saturate(.92) contrast(1.05)',
  },
  candy: { // bright white, one violet, round wide letters: a nail bar
    c: { bg: '#fbfaff', deep: '#21164a', card: '#ffffff', text: '#21164a', muted: '#645a92', accent: '#5b3fd6', accentInk: '#ffffff', accentText: '#5b3fd6', accentDeep: '#5b3fd6', paper: '#ffffff', ink: '#21164a', ink2: '#4f4580', sage: '#ff6b5a' },
    type: { display: "'Unbounded','Arial Black',sans-serif", logo: "600 17px/1 'Unbounded','Arial Black',sans-serif", tag: "600 13px/1.2 'Unbounded','Arial Black',sans-serif", h1: "600 clamp(32px,4.6vw,64px)/1.12 'Unbounded','Arial Black',sans-serif", h2: "600 clamp(28px,3.8vw,48px)/1.12 'Unbounded','Arial Black',sans-serif", h3: "600 17px/1.3 'Unbounded','Arial Black',sans-serif", price: "600 17px/1 'Unbounded','Arial Black',sans-serif", strip: "600 clamp(26px,4vw,56px)/1 'Unbounded','Arial Black',sans-serif", caption: "italic 600 22px/1.1 'Cormorant Garamond',Georgia,serif", case: 'none', h1Track: '-.025em', h2Track: '-.025em', r: '14px', rCtl: '999px', rCard: '28px' },
    ornament: false,
    light: true,
  },
  blush: { // pale and airy, plum ink, dusty rose, high-contrast serif
    c: { bg: '#f7f5f9', deep: '#2b1a35', card: '#ffffff', text: '#241a2c', muted: '#6a5d74', accent: '#a83f69', accentInk: '#ffffff', accentText: '#a83f69', accentDeep: '#a83f69', paper: '#ffffff', ink: '#241a2c', ink2: '#5a4d63', sage: '#e9c7d5' },
    type: { display: "'Cormorant Garamond',Georgia,serif", logo: "700 28px/1 'Cormorant Garamond',Georgia,serif", tag: "700 16px/1.2 'Cormorant Garamond',Georgia,serif", h1: "600 clamp(48px,6.6vw,96px)/.98 'Cormorant Garamond',Georgia,serif", h2: "600 clamp(38px,5vw,68px)/1 'Cormorant Garamond',Georgia,serif", h3: "600 28px/1.1 'Cormorant Garamond',Georgia,serif", price: "600 30px/1 'Cormorant Garamond',Georgia,serif", strip: "600 clamp(32px,5vw,72px)/1 'Cormorant Garamond',Georgia,serif", caption: "italic 600 22px/1.1 'Cormorant Garamond',Georgia,serif", case: 'none', h1Track: '-.015em', h2Track: '-.01em', r: '12px', rCtl: '999px', rCard: '28px' },
    ornament: false,
    light: true, // the page itself is light, the first screen and the loud band are still dark / accent
  },
  jade: { // mineral grey-green, deep jade, one accent, thin geometric letters: a salon that does not look like a rose
    c: { bg: '#eef1ee', deep: '#17211f', card: '#ffffff', text: '#17211f', muted: '#56635e', accent: '#2f5d50', accentInk: '#ffffff', accentText: '#2f5d50', accentDeep: '#2f5d50', paper: '#f8faf8', ink: '#17211f', ink2: '#4a5853', sage: '#cfdad2' },
    type: { display: "'Tenor Sans','Century Gothic',sans-serif", logo: "400 22px/1 'Tenor Sans','Century Gothic',sans-serif", tag: "400 15px/1.3 'Tenor Sans','Century Gothic',sans-serif", h1: "400 clamp(40px,5.2vw,76px)/1.04 'Tenor Sans','Century Gothic',sans-serif", h2: "400 clamp(32px,4.2vw,56px)/1.08 'Tenor Sans','Century Gothic',sans-serif", h3: "400 22px/1.2 'Tenor Sans','Century Gothic',sans-serif", price: "400 24px/1 'Tenor Sans','Century Gothic',sans-serif", strip: "400 clamp(28px,4.4vw,60px)/1 'Tenor Sans','Century Gothic',sans-serif", caption: "italic 600 22px/1.1 'Cormorant Garamond',Georgia,serif", case: 'none', h1Track: '-.01em', h2Track: '-.005em', r: '4px', rCtl: '999px', rCard: '20px' },
    ornament: false,
    light: true,
    grade: 'saturate(.86) contrast(.98) brightness(1.02)',
  },
  noir: { // black ground, black-and-white photographs, one red, uppercase grotesk: a premium barbershop without invented numbers
    c: { bg: '#0b0b0b', deep: '#050505', card: '#171717', text: '#efeeea', muted: '#9c9b95', accent: '#d91f26', accentInk: '#ffffff', accentText: '#ff5a5f', accentDeep: '#c81e24', paper: '#efeeea', ink: '#0b0b0b', ink2: '#3c3c39', sage: '#efeeea' },
    type: { display: "'Manrope','Arial',sans-serif", logo: "600 18px/1 'Manrope','Arial',sans-serif", tag: "600 13px/1.2 'Manrope','Arial',sans-serif", h1: "600 clamp(38px,5.4vw,84px)/1.02 'Manrope','Arial',sans-serif", h2: "600 clamp(30px,4vw,56px)/1.05 'Manrope','Arial',sans-serif", h3: "600 22px/1.15 'Manrope','Arial',sans-serif", price: "600 22px/1 'Manrope','Arial',sans-serif", strip: "600 clamp(26px,4vw,56px)/1 'Manrope','Arial',sans-serif", caption: "500 15px/1.35 var(--ui)", case: 'uppercase', h1Track: '-.01em', h2Track: '-.005em', r: '2px', rCtl: '999px', rCard: '14px' },
    ornament: false,
    quiet: true,
    grade: 'grayscale(1) contrast(1.12)',
  },
  mono: { // grey editorial first screen, black chapters, white and a single red dot: the quiet "studio" language
    c: { bg: '#0a0a0a', deep: '#050505', card: '#161616', text: '#f2f1ee', muted: '#9a9993', accent: '#d91f26', accentInk: '#ffffff', accentText: '#ff5a5f', accentDeep: '#c81e24', paper: '#f2f1ee', ink: '#0a0a0a', ink2: '#3c3c39', sage: '#f2f1ee' },
    type: { display: "'Manrope','Arial',sans-serif", logo: "600 18px/1 'Manrope','Arial',sans-serif", tag: "500 13px/1.2 'Manrope','Arial',sans-serif", h1: "600 clamp(40px,5.7vw,92px)/.94 'Manrope','Arial',sans-serif", h2: "600 clamp(30px,4vw,56px)/1.05 'Manrope','Arial',sans-serif", h3: "600 22px/1.15 'Manrope','Arial',sans-serif", price: "600 22px/1 'Manrope','Arial',sans-serif", strip: "600 clamp(26px,4vw,56px)/1 'Manrope','Arial',sans-serif", caption: "500 15px/1.35 var(--ui)", case: 'uppercase', h1Track: '-.035em', h2Track: '-.015em', r: '2px', rCtl: '10px', rCard: '14px' },
    ornament: false,
    quiet: true,
    grade: 'grayscale(1) contrast(1.1)',
  },
  street: { // a poster: bone paper, black, one signal orange, tall narrow capitals
    c: { bg: '#e3e4e1', deep: '#0e0e0e', card: '#ffffff', text: '#0e0e0e', muted: '#55554f', accent: '#ff4a1f', accentInk: '#0e0e0e', accentText: '#0e0e0e', accentDeep: '#0e0e0e', paper: '#f6f5f1', ink: '#0e0e0e', ink2: '#3d3d3a', sage: '#0e0e0e' },
    type: { display: "'Yanone Kaffeesatz','Arial Narrow',sans-serif", logo: "700 28px/1 'Yanone Kaffeesatz','Arial Narrow',sans-serif", tag: "700 19px/1.1 'Yanone Kaffeesatz','Arial Narrow',sans-serif", h1: "700 clamp(56px,9vw,150px)/.88 'Yanone Kaffeesatz','Arial Narrow',sans-serif", h2: "700 clamp(44px,6vw,92px)/.92 'Yanone Kaffeesatz','Arial Narrow',sans-serif", h3: "700 30px/1.05 'Yanone Kaffeesatz','Arial Narrow',sans-serif", price: "700 36px/1 'Yanone Kaffeesatz','Arial Narrow',sans-serif", strip: "700 clamp(40px,6vw,88px)/.9 'Yanone Kaffeesatz','Arial Narrow',sans-serif", caption: "500 16px/1.35 var(--ui)", case: 'uppercase', h1Type: 'clamp(56px,11vw,190px)', h1Track: '.005em', h2Track: '.005em', r: '0', rCtl: '0', rCard: '0' },
    ornament: false,
    light: true,
    quiet: true,
    grade: 'grayscale(1) contrast(1.12)',
  },
};

function ornamentTile(c) {
  const cols = [c.accent, c.paper, c.sage, c.paper]; const W = 112, H = 22, sw = 28; let p = '';
  cols.forEach((col, i) => { const a = i * sw; for (const o of [0, -W]) p += `<polygon fill="${col}" points="${a + H + o},0 ${a + H + sw + o},0 ${a + sw + o},${H} ${a + o},${H}"/>`; });
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>${p}</svg>`).replace(/'/g, '%27')}")`;
}

export const HERO_VARIANTS = ['split', 'phone', 'center', 'type', 'strip', 'frame', 'editorial'];

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
  need(p.hero.photo || ['phone', 'center', 'type'].includes(p.hero.variant || 'split'), 'hero.photo нужен для вариантов split и strip');
  if (p.masters != null) { need(Array.isArray(p.masters) && p.masters.length <= 6, 'masters: список до 6 человек'); for (const m of p.masters) need(m && m.name && String(m.name).length <= 40, 'у каждого мастера есть имя до 40 знаков'); }
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
    '--line2': `rgb(${rgb(c.text)} / .26)`, '--head': `rgb(${rgb({ frame: c.bg, type: look.quiet ? c.bg : c.accent }[p.hero.variant] || c.deep)} / .94)`,
    '--accent': c.accent, '--accent-ink': c.accentInk, '--accent-text': c.accentText, '--accent-hover': c.accent, '--accent-deep': c.accentDeep,
    '--paper': c.paper, '--ink': c.ink, '--ink2': c.ink2, '--ink-rgb': rgb(c.ink), '--ink-line': `rgb(${rgb(c.ink)} / .2)`,
    '--display': t.display, '--ui': "'Golos Text',system-ui,-apple-system,'Segoe UI',sans-serif", '--logo': t.logo, '--tag': t.tag, '--h1': t.h1, '--h2': t.h2, '--h3': t.h3, '--price': t.price, '--strip': t.strip, '--caption': t.caption,
    '--grade': look.grade || 'none', '--h1-type': t.h1Type || 'clamp(40px,7.6vw,128px)', '--case': t.case, '--h1-track': t.h1Track, '--h2-track': t.h2Track, '--r': t.r, '--r-ctl': t.rCtl, '--r-card': t.rCard, '--ease': 'cubic-bezier(.23,1,.32,1)',
    '--ornament': look.ornament ? ornamentTile(c) : 'none', '--focus': p.hero.focus || '60% 40%',
  };
  // On a light look the page body is light but the dark parts (first screen, strip text) keep light text: those are set per block below.
  const light = Boolean(look.light);
  const darkHero = !['frame', 'type'].includes(p.hero.variant || 'split');
  const photo = (src) => photoUrl(String(src));

  const open = mm(p.hours[0]); const step = 30; const first = open + 60;
  const taken = new Set(p.takenSlots || [2, 5]);
  const slots = Array.from({ length: 8 }, (_, i) => hhmm(first + i * step)).map((s, i) => `<button type="button" class="slot" style="--i:${i}" aria-pressed="false"${taken.has(i) ? ' disabled' : ''}>${s}</button>`).join('');
  const svc0 = p.services[0];
  const lines = String(p.hero.title).split('\n').map((l) => `<span class="l">${esc(tie(l))}</span>`).join('');
  const words = tie(p.statement || '').split(' ').filter(Boolean);
  const statement = words.map((w, i) => `${i ? ' ' : ''}<span style="--i:${i}">${esc(w)}</span>`).join('');
  const strip = [...p.services.map((s) => s.name), ...p.services.map((s) => s.name)].map((n) => `<span>${esc(n)}</span>`).join('');
  const menu = p.services.map((s) => `<li${s.popular ? ' class="pop"' : ''}><div class="row"><h3>${esc(s.name)}${s.popular ? ' <em class="badge">Популярно</em>' : ''}</h3><i class="dots"></i><span class="price">${rub(s.price)}</span></div>${s.desc ? `<p>${esc(s.desc)}</p>` : '<span></span>'}<span class="dur">${s.duration >= 60 ? `${Math.floor(s.duration / 60)}\u00a0ч${s.duration % 60 ? ` ${s.duration % 60}\u00a0мин` : ''}` : `${s.duration}\u00a0мин`}</span></li>`).join('');
  const masters = (p.masters || []).length ? `<section class="sec" id="masters"><div class="wrap"><h2 class="big">${esc(p.mastersTitle || 'Мастера')}</h2><div class="masters masters--${Math.min(p.masters.length, 3)}${p.mastersView === 'stack' ? ' masters--stack' : ''}">${p.masters.map((m, i) => `<article class="master${i === 0 ? ' master--lead' : ''}${m.photo ? '' : ' master--plain'}" style="--i:${i}">${m.photo ? `<img src="${photo(m.photo)}" alt="${esc(m.name)}" loading="lazy" decoding="async">` : ''}<div class="master__text"><h3>${esc(m.name)}</h3>${m.role ? `<p class="master__role">${esc(m.role)}</p>` : ''}${m.note ? `<p class="master__note">${esc(tie(m.note))}</p>` : ''}</div></article>`).join('')}</div></div></section>` : '';
  const gallery = (p.gallery || []).slice(0, 7).map((g, i) => `<figure><img src="${photo(g.src)}" alt="${esc(g.alt || g.caption || '')}" loading="${i ? 'lazy' : 'eager'}" decoding="async"><figcaption>${esc(g.caption || '')}</figcaption></figure>`).join('');
  const tel = String(p.phone || '').replace(/[^\d+]/g, '');
  const cta = p.cta || 'Записаться онлайн';
  const variant = p.hero.variant || 'split';
  const heroPhoto = p.hero.photo ? photo(p.hero.photo) : '';
  const title = `${p.name}${p.tagline ? ` — ${p.tagline}` : ''}`;

  const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)}\u00a0ч${m % 60 ? ` ${m % 60}\u00a0мин` : ''}` : `${m}\u00a0мин`);
  const stagePhotos = [...new Set([...p.services.map((s) => s.photo).filter(Boolean), ...(p.gallery || []).map((g) => g.src)])];
  const pick = (s, i) => (s.photo || (stagePhotos.length ? stagePhotos[i % stagePhotos.length] : ''));
  const selector = `<div class="pick" data-pick>
    <div class="pick__tabs" role="tablist" aria-label="Услуги">${p.services.map((s, i) => `<button type="button" role="tab" id="svc-t${i}" aria-controls="svc-p${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><span>${esc(s.name)}${s.popular ? ' <em class="badge">Популярно</em>' : ''}</span><b>${rub(s.price)}</b></button>`).join('')}</div>
    <div class="pick__stage">${p.services.map((s, i) => { const img = pick(s, i); return `<article role="tabpanel" id="svc-p${i}" aria-labelledby="svc-t${i}"${i ? ' hidden' : ''}>${img ? `<img src="${photo(img)}" alt="" width="900" height="1100" loading="${i ? 'lazy' : 'eager'}" decoding="async">` : ''}<div class="pick__txt"><h3>${esc(s.name)}</h3>${s.desc ? `<p>${esc(s.desc)}</p>` : ''}<p class="pick__meta"><span class="price">${rub(s.price)}</span><span>${fmtDur(s.duration)}</span></p><a class="btn btn--main" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}">${esc(cta)}</a></div></article>`; }).join('')}</div>
  </div>`;
  const cardsView = `<ul class="svcs" style="--cols:${p.services.length % 4 === 0 ? 4 : p.services.length % 3 === 0 ? 3 : 4}">${p.services.map((s, i) => { const img = pick(s, i); return `<li><a class="svc" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}">${img ? `<img src="${photo(img)}" alt="" width="600" height="800" loading="lazy" decoding="async">` : ''}<span class="svc__t"><b>${esc(s.name)}</b><span class="svc__p">${rub(s.price)} · ${fmtDur(s.duration)}</span></span></a></li>`; }).join('')}</ul>`;
  const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)}\u00a0ч${m % 60 ? ` ${m % 60}\u00a0мин` : ''}` : `${m}\u00a0мин`);
  const free = Array.from({ length: 8 }, (_, i) => hhmm(first + i * step)).filter((_, i) => !taken.has(i)).slice(0, 3);
  const card = `<aside class="card" aria-labelledby="card-t">
      <h2 id="card-t">Свободное время</h2>
      <p class="card__meta"><span>${esc(svc0.name)}\u00a0· ${dur(svc0.duration)}</span><span>${rub(svc0.price)}</span></p>
      <div class="slots" role="group" aria-label="Время">${slots}</div>
      <a class="btn btn--main" id="card-cta" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}" data-base="${esc(cta)}">${esc(cta)}</a>
      <p class="card__meta" style="margin:12px 0 0;font-size:13px"><span>Макет: время показано для примера</span></p>
    </aside>`;
  const bar = `<div class="bar" role="group" aria-label="Быстрая запись">
      <span class="bar__svc"><small>Услуга</small>${esc(svc0.name)}\u00a0· ${rub(svc0.price)}</span>
      <span class="bar__day"><small>Дата</small>Сегодня</span>
      <span class="bar__slots">${free.map((t) => `<button type="button" class="slot" aria-pressed="false">${t}</button>`).join('')}</span>
      <a class="btn btn--main" id="card-cta" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}" data-base="${esc(cta)}">${esc(cta)}</a>
    </div>`;
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

  const nMasters = (p.masters || []).length, minPrice = Math.min(...p.services.map((x) => x.price));
  const facts = `<ul class="ed__facts" aria-label="Коротко">${nMasters ? `<li><b data-count="${nMasters}">${nMasters}</b><span>${plural(nMasters, 'мастер', 'мастера', 'мастеров')}</span></li>` : ''}<li><b data-count="${p.services.length}">${p.services.length}</b><span>${plural(p.services.length, 'услуга', 'услуги', 'услуг')}</span></li><li><b data-count="${minPrice}" data-suffix="\u00a0₽">${rub(minPrice)}</b><span>цена от</span></li></ul>`;
  const sideSvc = p.services[1] || p.services[0];
  const sideImg = stagePhotos[1] || stagePhotos[0] || '';
  const clock = '<span class="clock" data-clock></span>';
  const headEd = `<header class="head head--pill" id="head"><div class="wrap head__in">
  <nav class="pill" aria-label="Разделы"><a class="is-on" href="#top">Главная</a><a href="#price">Цены</a>${gallery ? '<a href="#works">Работы</a>' : ''}${masters ? '<a href="#masters">Мастера</a>' : ''}<a href="#contacts">Контакты</a></nav>
  <a class="logo logo--sm" href="#top" translate="no">${esc(p.name)}</a>
  <div class="head__right">${clock}<a class="btn btn--main" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}">Записаться<span aria-hidden="true"> ↗</span></a></div>
</div></header>`;
  const heroEd = `<section class="hero hero--editorial" id="book">
  <div class="ed">
    <div class="ed__left">
      <p class="ed__tag">(${esc(p.tagline || 'Запись онлайн')})</p>
      <h1>${lines}</h1>
      ${p.hero.sub ? `<p class="ed__sub">${esc(tie(p.hero.sub))}</p>` : ''}
      <div class="ed__cta"><a class="btn btn--main" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}">${esc(cta)}<span aria-hidden="true"> ↗</span></a><a class="btn btn--ghost" href="tel:${esc(tel)}">${esc(p.phone || 'Позвонить')}</a></div>
      <div class="ed__card">${card}</div>
    </div>
    <figure class="ed__photo"><img src="${heroPhoto}" alt="" width="900" height="1100" fetchpriority="high"><figcaption class="ed__bar" translate="no"><b>${esc(p.name)}</b><i aria-hidden="true"></i></figcaption></figure>
    <aside class="ed__right" aria-label="Популярная услуга">
      <p class="ed__label">(${esc(sideSvc.popular ? 'Популярно' : 'Услуга')})</p>
      <a class="ed__mini" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}">${sideImg ? `<img src="${photo(sideImg)}" alt="" width="600" height="400" loading="lazy">` : ''}<span class="ed__mini__t"><b>${esc(sideSvc.name)}</b><small>${rub(sideSvc.price)} · ${fmtDur(sideSvc.duration)}</small></span><em aria-hidden="true">↗</em></a>
      ${facts}
    </aside>
  </div>
</section>`;
  const infoStrip = `<div class="infostrip"><span>${esc(p.address || p.tagline || '')}</span><span>Листайте вниз <i aria-hidden="true">↓</i></span><span>Ежедневно ${esc(p.hours[0])}–${esc(p.hours[1])}</span></div>`;
  const html = `<!doctype html>
<html lang="ru" data-name="${p.look || 'night'}"${light ? ' data-look="light"' : ''} data-hero="${variant}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="description" content="${esc(`${title}${p.address ? `, ${p.address}` : ''}. Услуги, цены и онлайн-запись на удобное время.`)}">
<meta name="theme-color" content="${esc(c.deep)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(`${p.tagline || 'Онлайн-запись'}${p.address ? `, ${p.address}` : ''}. Услуги, цены и запись на удобное время.`)}">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='${parseInt(t.r) > 6 ? 14 : 0}' fill='${c.accent}'/><text x='32' y='45' font-family='Georgia,serif' font-size='40' font-weight='700' text-anchor='middle' fill='${c.accentInk}'>${String(p.name).trim().slice(0, 1).toUpperCase().replace(/[<>&']/g, '')}</text></svg>`)}">
<title>${esc(title)}</title>
${heroPhoto ? `<link rel="preload" as="image" href="${heroPhoto}">` : ''}
<link rel="stylesheet" href="assets/fonts.css">
<link rel="stylesheet" href="assets/landing.css">
<style>:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}${light ? `body{background:var(--bg);color:var(--text)}${darkHero ? '.head{color:#fff}.hero{color:#fff}.hero__sub{color:#fff}.btn--ghost{color:#fff;border-color:rgb(255 255 255/.45)}' : ''}.strip{border-color:var(--ink)}.strip__row{color:var(--ink)}` : ''}${parseInt(t.rCard) >= 14 ? '.card,.bar,.book__form,.book__done{border-top:0}' : ''}</style>
</head>
<body>
${variant === 'editorial' ? headEd : `<header class="head" id="head"><div class="wrap head__in">
  <a class="logo" href="#top" translate="no">${esc(p.name)}</a>
  <nav aria-label="Разделы"><a href="#price">Цены</a>${gallery ? '<a href="#works">Работы</a>' : ''}${masters ? '<a href="#masters">Мастера</a>' : ''}<a href="#contacts">Контакты</a><a class="btn btn--main" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}">Записаться</a></nav>
</div></header>`}
<main id="top" data-open="${esc(p.hours[0])}" data-close="${esc(p.hours[1])}" data-taken="${[...taken].join(',')}">
${variant === 'editorial' ? heroEd : `<section class="hero hero--${variant}" id="book">
  ${heroPhoto && ['split', 'center', 'strip'].includes(variant) ? `<img class="hero__bg" src="${heroPhoto}" alt="" width="1800" height="1100" fetchpriority="high">` : ''}
  <div class="hero__in">
    <div class="hero__text">
      ${p.hero.concept && !look.quiet ? `<p class="tag">${esc(tie(p.hero.concept))}</p>` : ''}
      <h1>${lines}</h1>
      ${p.hero.sub ? `<p class="hero__sub">${esc(tie(p.hero.sub))}</p>` : ''}
      <div class="hero__cta"><a class="btn btn--main" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}">${esc(cta)}</a><a class="btn btn--ghost" href="tel:${esc(tel)}">${esc(p.phone || 'Позвонить')}</a></div>
    </div>
    ${variant === 'type' && heroPhoto ? `<img class="hero__photo" src="${heroPhoto}" alt="" width="900" height="1100" fetchpriority="high">` : ''}
    ${variant === 'type' ? `<p class="hero__time" aria-hidden="true"><small>Сегодня свободно</small><b data-next>${free[0] || ''}</b></p>` : ''}
    ${variant === 'phone' ? phone : variant === 'strip' ? bar : variant === 'frame' ? `<div class="frame"><img class="frame__img" src="${heroPhoto}" alt="" width="900" height="1100" fetchpriority="high">${card}</div>` : card}
  </div>
  ${look.ornament ? '<div class="ornament" aria-hidden="true"><i></i></div>' : ''}
</section>`}
${variant === 'editorial' ? infoStrip : `<div class="strip" aria-hidden="true"><div class="strip__row">${strip}</div></div>`}
<section class="sec paper" id="price"><div class="wrap ${['selector', 'cards'].includes(p.servicesView) ? 'stack' : 'split'}">
  <div><h2 class="big">Услуги и цены</h2><p class="lead">${esc(p.priceLead || 'Цена окончательная, без доплат на месте.')}</p></div>
  ${p.servicesView === 'selector' ? selector : p.servicesView === 'cards' ? cardsView : `<ul class="menu">${menu}</ul>`}
</div></section>
${gallery ? `<section class="sec" id="works"><div class="wrap"><h2 class="big">${esc(p.worksTitle || 'Работы')}</h2><div class="works">${gallery}</div></div></section>` : ''}
${masters}
${statement ? `<section class="say"><div class="wrap"><p style="--n:${words.length}">${statement}</p></div></section>` : ''}
<section class="sec paper" id="contacts"><div class="wrap end">
  <div><h2>${esc(tie(p.closing || 'Выберите время, остальное мы берём на себя.'))}</h2><a class="btn btn--main" data-book href="${esc(p.bookingUrl || 'tel:' + tel)}">${esc(cta)}</a></div>
  <div>${p.facade ? `<img class="facade" src="${photo(p.facade)}" alt="Вход в ${esc(p.name)}" loading="lazy" decoding="async">` : ''}<dl class="facts">
    ${p.address ? `<div><dt>Адрес</dt><dd>${esc(p.address)}</dd></div>` : ''}
    ${p.phone ? `<div><dt>Телефон</dt><dd><a href="tel:${esc(tel)}">${esc(p.phone)}</a></dd></div>` : ''}
    <div><dt>Часы</dt><dd>Ежедневно, ${esc(p.hours[0])}–${esc(p.hours[1])}</dd></div>
  </dl>${p.address ? `<p class="route"><a class="btn btn--ghost" href="https://yandex.ru/maps/?text=${encodeURIComponent(p.address)}" target="_blank" rel="noopener">Построить маршрут</a></p>` : ''}</div>
</div></section>
</main>
<footer class="foot"><div class="wrap"><span translate="no">© ${esc(p.name)}</span><span>Макет сайта, не окончательная версия${p.ownerLink ? ' · <a href="owner.html">Экран владельца, пример</a>' : ''} · <a href="privacy.html">Конфиденциальность</a></span></div></footer>
<div class="sticky" id="sticky" aria-hidden="true"><span class="sticky__t"><b translate="no">${esc(p.name)}</b><small>от ${rub(Math.min(...p.services.map((x) => x.price)))}</small></span><a class="btn btn--main" data-book tabindex="-1" href="${esc(p.bookingUrl || 'tel:' + tel)}">${esc(cta)}</a></div>
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
document.querySelectorAll('[data-pick]').forEach(function(root){var tabs=[].slice.call(root.querySelectorAll('[role=tab]')),panels=[].slice.call(root.querySelectorAll('[role=tabpanel]'));
function show(i,focus){tabs.forEach(function(t,k){t.setAttribute('aria-selected',k===i);t.tabIndex=k===i?0:-1});panels.forEach(function(x,k){x.hidden=k!==i});if(focus)tabs[i].focus()}
tabs.forEach(function(t,i){t.addEventListener('click',function(){show(i)});t.addEventListener('keydown',function(e){var n={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1}[e.key];if(n){e.preventDefault();show((i+n+tabs.length)%tabs.length,true)}else if(e.key==='Home'){e.preventDefault();show(0,true)}else if(e.key==='End'){e.preventDefault();show(tabs.length-1,true)}})})});
</script>
<script>
(function(){var m=document.getElementById('top');if(!m)return;function mm(t){var a=t.split(':');return +a[0]*60+ +a[1]}function f(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
var open=mm(m.dataset.open),close=mm(m.dataset.close),taken=(m.dataset.taken||'').split(',').filter(Boolean).map(Number);
var d=new Date(),now=d.getHours()*60+d.getMinutes(),start=Math.ceil((now+30)/30)*30,day='Сегодня';
if(now+30<open){start=open+60}else if(start+7*30>close){start=open+60;day='Завтра'}
var nodes=[].slice.call(document.querySelectorAll('.slots .slot'));
nodes.forEach(function(b,i){if(b.parentNode.classList.contains('bar__slots'))return;b.textContent=f(start+i*30)});
var free=nodes.filter(function(b,i){return !b.disabled&&!b.parentNode.classList.contains('bar__slots')});
var first=free[0]?free[0].textContent:f(start);
[].forEach.call(document.querySelectorAll('[data-next]'),function(n){n.textContent=first});
[].forEach.call(document.querySelectorAll('.hero__time small'),function(n){n.textContent=day==='Сегодня'?'Сегодня свободно':'Завтра свободно'});
[].forEach.call(document.querySelectorAll('[data-clock]'),function(n){var tick=function(){var d=new Date();n.textContent=d.toLocaleDateString('ru-RU',{weekday:'long'})+' · '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)+' · '+d.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})};tick();setInterval(tick,30000)});
var counters=[].slice.call(document.querySelectorAll('[data-count]'));
if(counters.length&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){counters.forEach(function(n){var to=+n.dataset.count,suf=n.dataset.suffix||'',t0=null;function fmt(v){return String(v).replace(/\\B(?=(\\d{3})+(?!\\d))/g,'\u00a0')+suf}
n.textContent=fmt(0);function step(ts){if(t0===null)t0=ts;var k=Math.min((ts-t0-700)/1400,1);if(k<0){requestAnimationFrame(step);return}var e=1-Math.pow(1-k,3);n.textContent=fmt(Math.round(to*e));if(k<1)requestAnimationFrame(step)}requestAnimationFrame(step)})}
var t=document.getElementById('card-t');if(t)t.textContent=day==='Сегодня'?'Свободное время сегодня':'Свободное время завтра';
})();
</script>
<script>
(function () {
  var head = document.getElementById('head');
  var solid = function () { head.classList.toggle('is-solid', window.scrollY > 40); };
  var sticky = document.getElementById('sticky'), heroEl = document.querySelector('.hero');
  var shell = function () { var on = window.scrollY > (heroEl ? heroEl.offsetHeight * 0.8 : 600); sticky.classList.toggle('is-on', on); sticky.setAttribute('aria-hidden', on ? 'false' : 'true'); sticky.querySelector('a').tabIndex = on ? 0 : -1; };
  solid(); shell(); window.addEventListener('scroll', function () { solid(); shell(); }, { passive: true });
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
