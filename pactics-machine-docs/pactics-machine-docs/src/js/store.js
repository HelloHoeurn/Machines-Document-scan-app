// Tiny observable store — the single source of truth for shared state.
// Replaces the scattered module-level globals (MACHINES, DASH, DUE, WHO, LANG…).
const state = {
  machines: [],                       // machines(code, machine_type, brand, …)
  current: null,                      // open machine (passport)
  dash: { maint: [], parts: [] },     // dashboard datasets
  due: { rows: [], q: '', mech: '', type: '', state: 'all',
         sortKey: 'daysLate', sortDir: 'desc' },
  who: localStorage.getItem('docs_who') || '',
  lang: localStorage.getItem('docs_lang') || 'en',
};

const subs = new Set();

export const store = {
  get: () => state,
  /** Shallow-merge a patch and notify subscribers. */
  set(patch) { Object.assign(state, patch); subs.forEach(fn => fn(state)); },
  /** Patch a nested slice, e.g. patch('due', { state:'overdue' }). */
  patch(key, partial) { state[key] = { ...state[key], ...partial }; subs.forEach(fn => fn(state)); },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};
