// Data-access for maintenance + parts (dashboard datasets) and per-machine
// maintenance records (passport view).
import { sb } from '../supabaseClient.js';
import { TABLES } from '../config.js';
import { store } from '../store.js';
import { addInterval } from '../utils/dates.js';
import { stamp } from '../utils/format.js';

/** Load the two dashboard datasets in parallel and push into the store. */
export async function loadDashboardData() {
  const [maint, parts] = await Promise.all([
    sb.from(TABLES.maintenance).select('*'),
    sb.from(TABLES.parts).select('*'),
  ]);
  store.set({ dash: { maint: maint.data || [], parts: parts.data || [] } });
  return store.get().dash;
}

/** Mark a maintenance record serviced today; reschedules next_due. */
export async function markDone(id) {
  const rec = store.get().dash.maint.find(t => t.id === id);
  if (!rec) return { error: { message: 'record not found' } };
  const done = stamp();
  const upd = {
    date_done: done,
    last_done: done,
    next_due: addInterval(new Date(), rec.maint_type || 'monthly'),
    updated_at: new Date().toISOString(),
    updated_by: store.get().who || 'dashboard',
  };
  return sb.from(TABLES.maintenance).update(upd).eq('id', id);
}

/* ---------------- per-machine maintenance records (passport view) ---------------- */

/** Load one machine's maintenance history, newest next_due first. */
export async function loadMachineTasks(code) {
  const res = await sb.from(TABLES.maintenance).select('*').eq('machine_code', code).order('next_due', { nullsFirst: false });
  return (res && !res.error && res.data) ? res.data : [];
}

/** Insert or update a single maintenance record. `id` is null for a new record. */
export function saveTask(id, rec) {
  return id
    ? sb.from(TABLES.maintenance).update(rec).eq('id', id)
    : sb.from(TABLES.maintenance).insert(rec);
}

/** Delete a single maintenance record by id. */
export function deleteTask(id) {
  return sb.from(TABLES.maintenance).delete().eq('id', id);
}
