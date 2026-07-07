// Date helpers used across the dashboard.
export const DAY_MS = 86400000;
export const ym = (d) => (d ? String(d).slice(0, 7) : '');
export const startOfToday = () => { const t = new Date(); t.setHours(0,0,0,0); return t; };
export const daysLate = (nextDue, today = startOfToday()) =>
  Math.round((today - new Date(nextDue)) / DAY_MS);
export function addInterval(date, maintType) {
  const d = new Date(date);
  if (maintType === 'weekly') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
