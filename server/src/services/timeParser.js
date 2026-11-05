// Tiny natural-language time parser: "in 10 minutes", "at 5pm", "tomorrow at 9:30", "tonight".
const UNITS = { s: 1e3, sec: 1e3, second: 1e3, m: 6e4, min: 6e4, minute: 6e4, h: 36e5, hr: 36e5, hour: 36e5, d: 864e5, day: 864e5, week: 6048e5 };

export function parseWhen(text, now = new Date()) {
  const t = text.toLowerCase();

  const rel = t.match(/\bin\s+(\d+|an?|one)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|[smhd])\b/);
  if (rel) {
    const n = /^\d+$/.test(rel[1]) ? Number(rel[1]) : 1;
    const unit = rel[2].replace(/s$/, '');
    const ms = UNITS[unit] ?? UNITS[unit.replace(/s$/, '')];
    if (ms) return { date: new Date(now.getTime() + n * ms), match: rel[0] };
  }

  const date = new Date(now);
  let matched = [];
  let dayShift = false;
  if (/\btomorrow\b/.test(t)) {
    date.setDate(date.getDate() + 1);
    matched.push('tomorrow');
    dayShift = true;
  }

  const at = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (at) {
    let h = Number(at[1]);
    const min = Number(at[2] || 0);
    if (at[3] === 'pm' && h < 12) h += 12;
    if (at[3] === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    date.setHours(h, min, 0, 0);
    if (!dayShift && date <= now) date.setDate(date.getDate() + 1);
    matched.push(at[0]);
    return { date, match: matched.join(' ') };
  }

  if (/\btonight\b/.test(t)) {
    date.setHours(20, 0, 0, 0);
    return { date, match: 'tonight' };
  }
  if (dayShift) {
    date.setHours(9, 0, 0, 0);
    return { date, match: 'tomorrow' };
  }
  return null;
}
