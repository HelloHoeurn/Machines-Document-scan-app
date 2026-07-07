// Central configuration & constants.
export const SUPABASE_URL = "https://febeqqrnjurnokflxyqx.supabase.co";
export const SUPABASE_KEY = "sb_publishable_cNSBIg9gkCjcIdxB8PB_ig_rbLrrhSR";

// In-app upload size cap (matches the original 25 MB app cap).
export const UPLOAD_CAP_BYTES = 25 * 1024 * 1024;

// The six maintenance checklist items (id -> i18n key used by CHECK_LABEL).
export const CHECK_ITEMS = [
  { id: 'clean_oil',      key: 'chk_clean_oil' },
  { id: 'spare_parts',    key: 'chk_spare_parts' },
  { id: 'air_system',     key: 'chk_air_system' },
  { id: 'electrical',     key: 'chk_electrical' },
  { id: 'presser_feed',   key: 'chk_presser_feed' },
  { id: 'safety_guards',  key: 'chk_safety_guards' },
];

// Supabase table names, in one place.
export const TABLES = {
  machines: 'machines',
  parts: 'spare_parts',
  maintenance: 'maintenance_schedule',
  documents: 'documents',
};
