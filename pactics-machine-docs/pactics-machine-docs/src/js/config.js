// Central configuration & constants.
export const SUPABASE_URL = "https://febeqqrnjurnokflxyqx.supabase.co";
export const SUPABASE_KEY = "sb_publishable_cNSBIg9gkCjcIdxB8PB_ig_rbLrrhSR";

// In-app upload size cap (matches the original 25 MB app cap).
export const UPLOAD_CAP_BYTES = 25 * 1024 * 1024;

// The maintenance checklist items (id -> i18n key used by CHECK_LABEL).
// NOTE: 'clean' and 'oil_change' used to be one combined item ('clean_oil').
// Older saved records may still contain 'clean_oil' — see normalizeChecks()
// in components/machinePassport.js, which expands it into both on edit.
export const CHECK_ITEMS = [
  { id: 'clean',          key: 'chk_clean' },
  { id: 'oil_change',     key: 'chk_oil_change' },
  { id: 'spare_parts',    key: 'chk_spare_parts' },
  { id: 'air_system',     key: 'chk_air' },
  { id: 'electrical',     key: 'chk_electrical' },
  { id: 'presser_feed',   key: 'chk_presser' },
  { id: 'safety_guards',  key: 'chk_guards' },
];

// Legacy combined item kept only so CHECK_LABEL can still render old records.
export const LEGACY_CHECK_KEY = { clean_oil: 'chk_clean_oil' };

// Production line options for the maintenance form (matches index.html).
export const LINE_OPTIONS = (() => {
  const list = ['LinePPA01', 'LinePPA02', 'LinePPA03', 'LinePPA04'];
  for (let i = 1; i <= 23; i++) {
    const n = 'Line' + String(i).padStart(2, '0');
    list.push(n);
    if (i === 3) list.push('Line03A', 'Line03B'); // sit right after Line03
  }
  return list;
})();

// Supabase table names, in one place.
export const TABLES = {
  machines: 'machines',
  parts: 'spare_parts',
  maintenance: 'maintenance_schedule',
  documents: 'documents',
};
