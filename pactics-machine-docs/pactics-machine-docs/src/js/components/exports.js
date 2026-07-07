// CSV / Excel export for the dashboard datasets.
import { store } from '../store.js';
import { machineName } from '../data/machines.js';
import { CHECK_LABEL } from '../i18n/index.js';
import { toCSV, download, stamp } from '../utils/format.js';
import { toast } from '../utils/toast.js';

const partsRows = () => store.get().dash.parts.map(p => ({
  Machine:p.machine_code, Type:machineName(p.machine_code), Part:p.part_name,
  'Part no':p.part_no||'', Qty:p.quantity==null?'':p.quantity, Unit:p.unit||'',
  'Replacement date':p.replaced_date||'', 'Replaced by':p.replaced_by||'', Notes:p.notes||'' }));
const maintRows = () => store.get().dash.maint.map(t => ({
  Machine:t.machine_code, Type:machineName(t.machine_code), 'Date done':t.date_done||'',
  Kind:t.maint_type||'', Line:t.line||'', Mechanic:t.mechanic||'',
  Checks:Array.isArray(t.checks)?t.checks.map(c=>CHECK_LABEL(c)||c).join('; '):'',
  'Next due':t.next_due||'', Remarks:t.notes||'' }));

export function wireExports() {
  const root = document.getElementById('view-dashboard');
  if (!root) return;
  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-exp]'); if (!btn) return;
    const kind = btn.dataset.exp;
    const rows = kind.startsWith('parts') ? partsRows() : maintRows();
    if (!rows.length) { toast('Nothing to export yet', 'err'); return; }
    const label = kind.startsWith('parts') ? 'spare_parts' : 'maintenance';
    if (kind.endsWith('csv')) { download(`pactics_${label}_${stamp()}.csv`, toCSV(rows), 'text/csv'); toast('CSV downloaded', 'ok'); return; }
    if (typeof window.XLSX === 'undefined') { download(`pactics_${label}_${stamp()}.csv`, toCSV(rows), 'text/csv'); toast('Excel unavailable — CSV instead', 'ok'); return; }
    try { const ws = window.XLSX.utils.json_to_sheet(rows); const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, label); window.XLSX.writeFile(wb, `pactics_${label}_${stamp()}.xlsx`); toast('Excel downloaded', 'ok');
    } catch (err) { download(`pactics_${label}_${stamp()}.csv`, toCSV(rows), 'text/csv'); toast('Excel failed — CSV instead', 'ok'); }
  });
}
