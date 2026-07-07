// Data-access for maintenance + parts (dashboard datasets).
import { sb } from '../supabaseClient.js';
import { TABLES } from '../config.js';
import { store } from '../store.js';
import { addInterval, stamp } from '../utils/dates.js';

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
