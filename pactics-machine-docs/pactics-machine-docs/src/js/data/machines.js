// Data-access for machines + a shared name lookup.
import { sb } from '../supabaseClient.js';
import { TABLES } from '../config.js';
import { store } from '../store.js';

export async function loadMachines() {
  const { data } = await sb.from(TABLES.machines).select('*').order('code');
  store.set({ machines: data || [] });
  return store.get().machines;
}
export function machineName(code) {
  const m = store.get().machines.find(x => x.code === code);
  if (!m) return code;
  return [m.machine_type, m.brand].filter(Boolean).join(' · ') || code;
}
