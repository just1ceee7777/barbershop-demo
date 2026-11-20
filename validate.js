// The rules the settings must pass, shared by the demo's mock server and by make.html (which warns about a bad link before it is made).
// Condensed from validateSettings in server.js.
(() => {
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  function validate(input) {
    const str = (v, max, label, req) => { const s = typeof v === 'string' ? v.trim() : ''; if (req && !s) throw new Error(`Заполните поле «${label}»`); if (s.length > max) throw new Error(`Поле «${label}» длиннее ${max} символов`); return s; };
    const int = (v, min, max, label) => { const n = v === '' || v == null ? NaN : Number(v); if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label}: целое число от ${min} до ${max}`); return n; };
    const link = (v, label) => { const s = str(v, 200, label); if (s && !/^https?:\/\/\S+$/.test(s)) throw new Error(`${label}: ссылка должна начинаться с https:// или http://`); return s; };
    // In the demo a photo is a small data: URL kept in this browser; the real site stores files and keeps their path.
    const photo = (v, label) => { const s = typeof v === 'string' ? v : ''; if (/^photos\/[a-z]+-\d\.jpg$/.test(s)) return s; if (s && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]{1,400000}$/.test(s)) throw new Error(`${label}: неверный файл`); return s; };
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

  window.validateSettings = validate;
})();
