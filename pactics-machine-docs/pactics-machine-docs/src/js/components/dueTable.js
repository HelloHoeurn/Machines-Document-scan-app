// The 'Maintenance due' workbench: filters, sort, fixed-height scroll box,
// color-coded dates, Days-late column, inline actions. Reads/writes store.due.
import { store } from '../store.js';
import { TX } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { markDone } from '../data/maintenance.js';
import { toast } from '../utils/toast.js';
import { navigate, gotoMachine } from '../router.js';

function filtered() {
  const d = store.get().due;
  let r = d.rows.slice();
  if (d.state === 'overdue') r = r.filter(x => x.daysLate > 0);
  else if (d.state === 'soon') r = r.filter(x => x.daysLate <= 0);
  const q = d.q.trim().toLowerCase();
  if (q) r = r.filter(x => (x.code + ' ' + x.type + ' ' + x.brand + ' ' + x.mechanic).toLowerCase().includes(q));
  if (d.mech) r = r.filter(x => x.mechanic === d.mech);
  if (d.type) r = r.filter(x => x.type === d.type);
  const k = d.sortKey, dir = d.sortDir === 'asc' ? 1 : -1;
  r.sort((a, b) => {
    if (k === 'daysLate') return (a.daysLate - b.daysLate) * dir;
    const av = String(a[k] || '').toLowerCase(), bv = String(b[k] || '').toLowerCase();
    return av < bv ? -dir : av > bv ? dir : 0;
  });
  return r;
}

const daysLateCell = (x) =>
  x.daysLate > 0 ? `<span class="dl dl-${x.tier}">+${x.daysLate}d</span>`
  : x.daysLate === 0 ? `<span class="dl dl-soon">${TX('due_today')}</span>`
  : `<span class="dl dl-fut">${TX('due_in')} ${Math.abs(x.daysLate)}d</span>`;

export function renderDueTable() {
  const box = document.getElementById('dash-due');
  const d = store.get().due;
  if (!d.rows.length) { box.innerHTML = `<div class="empty">${TX('nothing_due')}</div>`; return; }

  const mechs = [...new Set(d.rows.map(r => r.mechanic).filter(Boolean))].sort();
  const types = [...new Set(d.rows.map(r => r.type).filter(Boolean))].sort();
  const opt = (v, label, sel) => `<option value="${esc(v)}"${sel === v ? ' selected' : ''}>${esc(label)}</option>`;
  const rows = filtered();
  const caret = (k) => d.sortKey === k ? (d.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const th = (k, label) => `<th class="sortable${d.sortKey === k ? ' sorted' : ''}" data-sort="${k}">${label}${caret(k)}</th>`;

  box.innerHTML = `
  <div class="due-controls">
    <div class="due-search"><input id="due-q" placeholder="${TX('search_due_ph')}" value="${esc(d.q)}"></div>
    <select id="due-mech" class="due-sel"><option value="">${TX('f_all_mech')}</option>${mechs.map(m => opt(m, m, d.mech)).join('')}</select>
    <select id="due-type" class="due-sel"><option value="">${TX('f_all_type')}</option>${types.map(t => opt(t, t, d.type)).join('')}</select>
  </div>
  <div class="due-scroll"><table class="doc dense"><thead><tr>
    ${th('code', TX('col_machine'))}${th('type', TX('col_type'))}${th('mechanic', TX('col_mechanic'))}${th('next_due', TX('col_nextdue'))}${th('daysLate', TX('col_days_late'))}<th class="act-h">${TX('col_actions')}</th>
  </tr></thead><tbody>${
    rows.length ? rows.map(x => `<tr>
      <td><a href="#" data-open="${esc(x.code)}" class="mlink">${esc(x.code)}</a></td>
      <td>${esc(x.type || '—')}${x.brand ? `<div class="upd">${esc(x.brand)}</div>` : ''}</td>
      <td>${esc(x.mechanic || '—')}</td>
      <td><span class="dt tier-${x.tier}">${esc(x.next_due)}</span></td>
      <td>${daysLateCell(x)}</td>
      <td class="act-c">
        <button class="ibtn ibtn-ok" data-done="${x.id}" title="${TX('act_done')}" aria-label="${TX('act_done')}">✓</button>
        <button class="ibtn" data-go="${esc(x.code)}" title="${TX('act_open')}" aria-label="${TX('act_open')}">↗</button>
      </td>
    </tr>`).join('') : `<tr><td colspan="6" class="empty">${TX('nothing_due')}</td></tr>`
  }</tbody></table></div>
  <div class="due-scrollcount">${TX('showing')} ${rows.length} ${TX('showing_of')} ${d.rows.length}</div>`;

  const patch = (p) => { store.patch('due', p); renderDueTable(); };
  const q = document.getElementById('due-q');
  if (q) q.oninput = () => { const pos = q.selectionStart; store.patch('due', { q: q.value }); renderDueTable();
    const n = document.getElementById('due-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } };
  document.getElementById('due-mech').onchange = e => patch({ mech: e.target.value });
  document.getElementById('due-type').onchange = e => patch({ type: e.target.value });
  box.querySelectorAll('th.sortable').forEach(h => h.onclick = () => {
    const k = h.dataset.sort;
    if (d.sortKey === k) patch({ sortDir: d.sortDir === 'asc' ? 'desc' : 'asc' });
    else patch({ sortKey: k, sortDir: k === 'daysLate' ? 'desc' : 'asc' });
  });
  box.querySelectorAll('[data-open],[data-go]').forEach(a => a.onclick = e => { e.preventDefault(); gotoMachine(a.dataset.open || a.dataset.go); });
  box.querySelectorAll('[data-done]').forEach(b => b.onclick = async () => {
    if (!confirm(TX('confirm_done'))) return;
    const res = await markDone(+b.dataset.done);
    if (res.error) { toast('Update failed: ' + res.error.message, 'err'); return; }
    toast(TX('m_marked_done'), 'ok');
    const { loadDashboard } = await import('./dashboard.js');
    await loadDashboard();
  });
}
