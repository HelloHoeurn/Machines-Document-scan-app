// Dashboard orchestrator: loads data, renders KPI tiles (as filter tabs),
// health chip, the due workbench, breakdown bars, recent parts & activity.
import { store } from '../store.js';
import { TX } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { ICON } from '../icons.js';
import { ym, startOfToday, DAY_MS } from '../utils/dates.js';
import { loadDashboardData } from '../data/maintenance.js';
import { renderDueTable } from './dueTable.js';
import { gotoMachine } from '../router.js';

export async function loadDashboard() {
  await loadDashboardData();
  renderDashboard();
}

export function renderDashboard() {
  const $ = (id) => document.getElementById(id);
  const { dash, machines, lang } = store.get();
  const today = startOfToday();
  const thisMonth = new Date().toISOString().slice(0, 7);

  const withDue = dash.maint.filter(t => t.next_due);
  const overdue = withDue.filter(t => new Date(t.next_due) < today);
  const soon = withDue.filter(t => { const days = Math.round((new Date(t.next_due) - today) / DAY_MS); return days >= 0 && days <= 7; });
  const maintThisMonth = dash.maint.filter(t => ym(t.date_done) === thisMonth).length;
  const partsThisMonth = dash.parts.filter(p => ym(p.replaced_date) === thisMonth).length;

  const dueState = store.get().due.state;
  const statCard = (val, label, tone, icon, alert, state) => {
    const cl = ['stat', 'tone-' + tone];
    if (alert && val > 0) cl.push('alert');
    if (state) { cl.push('clickable'); if (dueState === state) cl.push('active'); }
    return `<div class="${cl.join(' ')}"${state ? ` data-state="${state}" role="button" tabindex="0"` : ''}>
      <div class="stat-top"><div class="n">${val}</div><div class="ic">${icon}</div></div>
      <div class="l">${label}</div></div>`;
  };
  $('dash-stats').innerHTML =
    statCard(overdue.length, TX('st_overdue'), 'err', ICON.overdue, true, 'overdue') +
    statCard(soon.length, TX('st_due7'), 'warn', ICON.soon, true, 'soon') +
    statCard(maintThisMonth, TX('st_this_month'), 'ok', ICON.month, false) +
    statCard(dash.maint.length, TX('st_total_records'), 'info', ICON.records, false) +
    statCard(partsThisMonth, TX('st_parts_month'), 'ok', ICON.partsM, false) +
    statCard(dash.parts.length, TX('st_parts_total'), 'info', ICON.partsT, false);
  $('dash-stats').querySelectorAll('.stat.clickable').forEach(c => {
    const flip = () => { const s = c.dataset.state; store.patch('due', { state: dueState === s ? 'all' : s }); renderDashboard(); };
    c.onclick = flip;
    c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
  });

  const dh = $('dash-health');
  if (dh) {
    if (overdue.length) { dh.className = 'dash-health err'; dh.innerHTML = `<span class="dot"></span>${overdue.length} ${TX('st_overdue')}`; }
    else if (soon.length) { dh.className = 'dash-health warn'; dh.innerHTML = `<span class="dot"></span>${soon.length} ${TX('st_due7')}`; }
    else { dh.className = 'dash-health'; dh.innerHTML = `<span class="dot"></span>${TX('nothing_due')}`; }
  }
  const dd = $('dash-date');
  if (dd) { try { dd.textContent = new Date().toLocaleDateString(lang === 'km' ? 'km-KH' : 'en-GB', { day:'numeric', month:'short', year:'numeric' }); } catch (e) { dd.textContent = new Date().toISOString().slice(0,10); } }

  // build the workbench dataset
  store.patch('due', { rows: [...overdue, ...soon].map(t => {
    const dl = Math.round((today - new Date(t.next_due)) / DAY_MS);
    const tier = dl > 30 ? 'critical' : (dl > 7 ? 'late' : 'soon');
    const m = machines.find(x => x.code === t.machine_code);
    return { id: t.id, code: t.machine_code, type: (m && m.machine_type) || '', brand: (m && m.brand) || '',
             mechanic: t.mechanic || '', maint_type: t.maint_type || 'monthly', next_due: t.next_due, daysLate: dl, tier };
  }) });
  renderDueTable();

  // breakdown bars
  const byLine = {}, byMech = {};
  dash.maint.forEach(t => { if (t.line) byLine[t.line] = (byLine[t.line] || 0) + 1; if (t.mechanic) byMech[t.mechanic] = (byMech[t.mechanic] || 0) + 1; });
  const lineRows = Object.entries(byLine).sort((a, b) => b[1] - a[1]);
  const mechRows = Object.entries(byMech).sort((a, b) => b[1] - a[1]);
  const bd = $('dash-breakdown');
  if (bd) {
    if (!lineRows.length && !mechRows.length) { bd.innerHTML = `<div class="empty">${TX('no_maint')}</div>`; }
    else {
      const maxLine = Math.max(1, ...lineRows.map(r => r[1]));
      const maxMech = Math.max(1, ...mechRows.map(r => r[1]));
      const barRow = (label, v, max) => `<div class="bar-row"><div class="bl">${label}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v / max * 100)}%"></div></div><div class="bv">${v}</div></div>`;
      bd.innerHTML = `<div class="bd-grid">
        <div class="bd-col line"><div class="bd-col-h">${TX('by_line')}</div>${lineRows.map(([k, v]) => barRow('Line ' + esc(k), v, maxLine)).join('') || '<div class="mini">—</div>'}</div>
        <div class="bd-col mech"><div class="bd-col-h">${TX('by_mechanic')}</div>${mechRows.map(([k, v]) => barRow(esc(k), v, maxMech)).join('') || '<div class="mini">—</div>'}</div>
      </div>`;
    }
  }
}
