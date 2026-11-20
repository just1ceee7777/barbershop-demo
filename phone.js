// Phone numbers for the booking form: the Russian mask, other countries, and the checks the form uses. No DOM, so it is tested directly.
// Countries a client may call from. '' is "another country": the number is typed with its own code.
export const COUNTRIES = [['+7', 'Россия, Казахстан'], ['+375', 'Беларусь'], ['+380', 'Украина'], ['+374', 'Армения'], ['+995', 'Грузия'], ['+998', 'Узбекистан'], ['+996', 'Киргизия'],
  ['+992', 'Таджикистан'], ['+994', 'Азербайджан'], ['+373', 'Молдова'], ['+49', 'Германия'], ['+90', 'Турция'], ['+971', 'ОАЭ'], ['', 'Другая страна']];
const CODES = COUNTRIES.map((c) => c[0]).filter(Boolean).sort((x, y) => y.length - x.length); // longest first, so +375 is not read as +3
const group = (d, sizes) => { const out = []; let i = 0; for (const n of sizes) { if (i >= d.length) break; out.push(d.slice(i, i + n)); i += n; } if (i < d.length) out.push(d.slice(i)); return out.join(' '); };

// The Russian number keeps its mask. Other numbers: the code, then the rest in small groups; at most 15 digits in all (the server's limit).
export function formatPhone(raw, cc) {
  let d = raw.replace(/\D/g, '');
  if (cc === '+7') {
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
  const code = cc.replace(/\D/g, '');
  if (code && d.startsWith(code)) d = d.slice(code.length);
  d = d.slice(0, 15 - code.length);
  if (!d.length) return '';
  return `${cc || '+'}${cc ? ' ' : ''}${group(d, [3, 3, 3, 3])}`.trim();
}
// A pasted or typed "+380…" moves the country selector to match.
export function countryOf(raw, current) {
  const t = raw.trim();
  if (!t.startsWith('+')) return current;
  const digits = t.replace(/\D/g, '');
  const hit = CODES.find((c) => digits.startsWith(c.slice(1)));
  return hit ?? '';
}
export const phoneOk = (v, cc) => {
  const d = v.replace(/\D/g, '');
  if (cc === '+7') return d.replace(/^[78]/, '').length === 10;
  return d.length >= 10 && d.length <= 15 && d.length - cc.replace(/\D/g, '').length >= 6;
};
export const phonePrefix = (cc) => (cc === '+7' ? '+7 (' : cc ? `${cc} ` : '+');
