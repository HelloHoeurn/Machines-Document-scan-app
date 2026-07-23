// Machine detail (passport) view.
// Layout: [ details (left) ] [ photo (centered) ] [ QR (right) ]
// Photo strategy, in priority order:
//   1) machine.image_url (saved photo)                          -> show it
//   2) reference image in OUR OWN storage by brand/model        -> show it (display-only)
//   3) parse the machine's catalog/manuals:
//        a) an attached image document                          -> show it
//        b) first page of an attached PDF manual (pdf.js)       -> show thumbnail
//   4) type-based blueprint schematic                           -> always looks populated
// A manual upload or dropped URL overrides everything and is saved to Supabase.
import { store } from '../store.js';
import { sb } from '../supabaseClient.js';
import { SUPABASE_URL, TABLES, CHECK_ITEMS, LINE_OPTIONS } from '../config.js';
import { TX, CHECK_LABEL } from '../i18n/index.js';
import { esc, stamp } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import { $ } from '../utils/dom.js';
import { loadMachineTasks, saveTask, deleteTask } from '../data/maintenance.js';

const PHOTO_BUCKET = 'catalogs';
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

/* ---------- Option B: blueprint schematics by machine type ---------- */
const SEWING_ART = `
  <rect x="16" y="72" width="100" height="14" rx="3"/>
  <path d="M96 72 V44 q0 -12 12 -12"/>
  <path d="M108 32 H44 q-10 0 -10 10 v6"/>
  <rect x="30" y="46" width="10" height="12" rx="2"/>
  <path d="M35 58 V72"/>
  <circle cx="104" cy="46" r="6"/>`;
const PRESS_ART = `
  <rect x="24" y="20" width="84" height="10" rx="2"/>
  <path d="M32 30 V78"/><path d="M100 30 V78"/>
  <rect x="20" y="78" width="92" height="12" rx="3"/>
  <rect x="52" y="34" width="28" height="20" rx="2"/>
  <path d="M66 54 V66"/>
  <rect x="50" y="66" width="32" height="6" rx="2"/>`;

function blueprint(type) {
  const t = (type || '').toLowerCase();
  const art = /press|cutter|fus|iron|heat|weld/.test(t) ? PRESS_ART : SEWING_ART;
  const label = esc((type || 'MACHINE').toUpperCase()).slice(0, 16);
  return `<svg class="bp" viewBox="0 0 132 112" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs><pattern id="bpgrid" width="11" height="11" patternUnits="userSpaceOnUse">
      <path d="M11 0 H0 V11" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.18"/></pattern></defs>
    <rect width="132" height="112" fill="url(#bpgrid)"/>
    <g fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">${art}</g>
    <text x="66" y="106" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.75" font-family="system-ui,sans-serif" letter-spacing="0.4">${label}</text>
  </svg>`;
}

/* ---------- photo cell markup ---------- */
function photoInner(m) {
  if (m.image_url) return `<img src="${esc(m.image_url)}" alt="${esc(m.code)}">`;
  return `<div class="bpwrap">${blueprint(m.machine_type)}<span class="bptag">${TX('schematic')}</span></div>`;
}
function photoBlock(m) {
  const hint = TX(m.image_url ? 'change_photo' : 'add_photo');
  return `<div class="pphoto" id="pphoto" title="${hint}">${photoInner(m)}<div class="edithint">${hint}</div></div>`;
}

const qrLink = (code) => location.origin + location.pathname + '?m=' + encodeURIComponent(code);

export function openMachine(code) {
  const m = store.get().machines.find((x) => x.code === code);
  if (!m) { toast('Machine ' + code + ' not found', 'err'); return; }
  store.set({ current: m });

  document.querySelectorAll('main > section').forEach((s) => s.classList.add('hidden'));
  const view = $('view-detail');
  view.classList.remove('hidden');
  window.scrollTo(0, 0);

  // DOM order = details, photo, QR  -> grid 1fr/auto/1fr centers the photo.
  view.innerHTML = `
    <div class="detail-top"><span class="back" id="back">← ${TX('all_machines')}</span></div>
    <div class="passport" id="passport">
      <div class="pinfo">
        <div class="pcode">${esc(m.code)}</div>
        <div class="pmeta">${esc(m.machine_type || '')}${m.brand ? ' · ' + esc(m.brand) : ''}${m.model ? ' · ' + esc(m.model) : ''}</div>
        <div class="pmeta">${m.serial ? 'Serial ' + esc(m.serial) : ''}${m.fixed_asset ? ' · FA ' + esc(m.fixed_asset) : ''}</div>
      </div>
      ${photoBlock(m)}
      <div class="qr-wrap"><div class="qrbox" id="qr"></div><div class="lbl">${esc(m.code)}</div>
        <button class="btn btn-secondary btn-sm" id="print-qr" style="margin-top:8px">${TX('print_qr')}</button>
      </div>
    </div>
    <div class="doc-section"><div class="sec-head"><h2>${TX('catalog_manuals')}</h2></div><div id="docs-body"></div></div>
    <div class="doc-section"><div class="sec-head"><h2>${TX('spare_parts')}</h2></div><div id="parts-body"></div></div>
    <div class="doc-section"><div class="sec-head">
        <h2>${TX('maint_schedule')}</h2>
        <button class="btn btn-primary btn-sm" id="add-task">${TX('add_record')}</button>
      </div><div id="maint-body"></div></div>
    ${taskSheetMarkup()}`;

  try { new window.QRCode($('qr'), { text: qrLink(m.code), width: 110, height: 110, correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) {}

  $('back').onclick = async () => { const { navigate } = await import('../router.js'); navigate('list'); };
  $('print-qr').onclick = async () => { try { const mod = await import('./qrPrint.js'); mod.printQR?.(m); } catch (e) { toast('Print view not ported yet', 'err'); } };

  wirePhotoCell();
  if (!m.image_url) autoResolveImage(m);
  wireTaskSheet();
  loadTasks(m.code);
}

/* ---------- interactions: click-to-upload + drag/drop (file OR url) ---------- */
function wirePhotoCell() {
  const el = $('pphoto');
  if (!el) return;
  el.onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => uploadMachinePhoto(inp.files[0]);
    inp.click();
  };
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag'); });
  el.addEventListener('dragleave', () => el.classList.remove('drag'));
  el.addEventListener('drop', (e) => {
    e.preventDefault(); el.classList.remove('drag');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) { uploadMachinePhoto(f); return; }
    const url = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '').trim();
    if (url) saveImageUrl(url);
  });
}

/* ---------- automatic resolution (display-only; never auto-saves) ---------- */
async function autoResolveImage(m) {
  const ref = await findReferenceImage(m);         // 2) our own brand/model reference
  if (ref) return swapPhoto(m, ref);
  const doc = await findImageFromDocs(m);          // 3) catalog/manual image or PDF cover
  if (doc) return swapPhoto(m, doc);               // 4) else the schematic stays
}

function swapPhoto(m, url) {
  if (store.get().current?.code !== m.code) return;              // navigated away
  const holder = $('pphoto');
  if (!holder || !holder.querySelector('.bpwrap')) return;       // don't cover a real image
  holder.innerHTML = `<img src="${esc(url)}" alt="${esc(m.code)}"><div class="edithint">${TX('change_photo')}</div>`;
}

const loadable = (url) => new Promise((res) => { const im = new Image(); im.onload = () => res(true); im.onerror = () => res(false); im.src = url; });

async function findReferenceImage(m) {
  if (!m.brand && !m.model) return null;
  const key = [m.brand, m.model].filter(Boolean).join('/').replace(/[^\w./-]+/g, '_');
  const base = `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/machine-refs/${key}`;
  for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
    if (await loadable(base + ext)) return base + ext;
  }
  return null;
}

const docPublicUrl = (filePath) => `${SUPABASE_URL}/storage/v1/object/public/${filePath}`;
const isImageDoc = (d) => /^image\//.test(d.mime || '') || /\.(png|jpe?g|webp|gif)$/i.test(d.file_name || '');
const isPdfDoc = (d) => (d.mime || '').includes('pdf') || /\.pdf$/i.test(d.file_name || '');

async function fetchMachineDocs(m) {
  const qs = [sb.from(TABLES.documents).select('*').eq('scope', 'machine').eq('machine_code', m.code)];
  if (m.model) qs.push(sb.from(TABLES.documents).select('*').eq('scope', 'model').eq('model', m.model));
  const res = await Promise.all(qs);
  return res.flatMap((r) => (r && r.data) || []);
}

async function findImageFromDocs(m) {
  let docs;
  try { docs = await fetchMachineDocs(m); } catch (e) { return null; }
  if (!docs || !docs.length) return null;
  const img = docs.find(isImageDoc);
  if (img) return docPublicUrl(img.file_path);
  const pdf = docs.find(isPdfDoc);
  if (pdf) return await pdfThumb(docPublicUrl(pdf.file_path));
  return null;
}

/* ---------- lazy pdf.js: render page 1 of a manual to a thumbnail ---------- */
let _pdfjs;
async function getPdfjs() {
  if (_pdfjs) return _pdfjs;
  const lib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs');
  lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';
  _pdfjs = lib;
  return lib;
}
async function pdfThumb(url) {
  try {
    const pdfjs = await getPdfjs();
    const pdf = await pdfjs.getDocument({ url }).promise;
    const page = await pdf.getPage(1);
    const raw = page.getViewport({ scale: 1 });
    const scale = Math.min(400 / raw.width, 2);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch (e) { return null; }
}

/* ---------- manual actions override + persist ---------- */
export async function uploadMachinePhoto(file) {
  const m = store.get().current;
  if (!file || !m) return;
  if (!/^image\//.test(file.type || '')) { toast(TX('img_only'), 'err'); return; }
  if (file.size > MAX_PHOTO_BYTES) { toast('Image too large (max 25 MB)', 'err'); return; }
  toast(TX('uploading'), 'ok');
  const safe = (file.name || 'photo.jpg').replace(/[^\w.\-]+/g, '_');
  const path = `machine-photos/${m.code}/${Date.now()}_${safe}`.replace(/\s+/g, '_');
  const up = await sb.storage.from(PHOTO_BUCKET).upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (up.error) { toast('Upload failed: ' + up.error.message, 'err'); return; }
  await persistImageUrl(`${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${up.data.path}`);
}

async function saveImageUrl(url) {
  if (!/^https?:\/\/\S+/i.test(url)) { toast(TX('img_only'), 'err'); return; }
  await persistImageUrl(url.trim());
}

async function persistImageUrl(url) {
  const m = store.get().current;
  if (!m) return;
  const upd = await sb.from(TABLES.machines).update({ image_url: url }).eq('code', m.code);
  if (upd.error) { toast('Saved image but linking failed — add a machines UPDATE policy. (' + upd.error.message + ')', 'err'); return; }
  m.image_url = url;
  const inList = store.get().machines.find((x) => x.code === m.code);
  if (inList) inList.image_url = url;
  store.set({ current: m });
  toast(TX('photo_updated'), 'ok');
  openMachine(m.code);
}

/* ==================== maintenance schedule (per-machine) ==================== */
// Ported from the single-file app's openTask/renderTasks/t-save/delTask, with
// the three fixes preserved:
//  1) Date done defaults to today on new records.
//  2) Line is a dropdown (LINE_OPTIONS) instead of free text, but keeps any
//     legacy free-text value already stored on a record.
//  3) 'clean' and 'oil_change' are separate checklist items; normalizeChecks()
//     expands an older combined 'clean_oil' record into both on edit.

let TASKS = [];
let taskChecks = new Set();
let editingTaskId = null;

async function loadTasks(code) {
  $('maint-body').innerHTML = `<div class="empty">Loading…</div>`;
  TASKS = await loadMachineTasks(code);
  renderTasks();
}

function renderTasks() {
  const b = $('maint-body');
  if (!b) return; // navigated away before the load resolved
  if (!TASKS.length) { b.innerHTML = `<div class="empty">${TX('no_records')}</div>`; return; }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rows = [...TASKS].sort((a, b) => {
    const da = a.date_done || a.last_done || '', db = b.date_done || b.last_done || '';
    return db.localeCompare(da);
  });
  b.innerHTML = `<table class="doc"><thead><tr>
    <th>${TX('date_done')}</th><th>${TX('checks_done')}</th><th>${TX('next_due_opt')}</th><th></th></tr></thead><tbody>` +
    rows.map(t => {
      let dueClass = '', dueNote = '';
      if (t.next_due) {
        const d = new Date(t.next_due), days = Math.round((d - today) / 86400000);
        if (days < 0) { dueClass = 'due-over'; dueNote = ' (overdue)'; }
        else if (days <= 7) { dueClass = 'due-soon'; dueNote = ' (soon)'; }
      }
      const checks = Array.isArray(t.checks) ? t.checks : [];
      const chips = checks.map(c => `<span class="check-chip">${esc(CHECK_LABEL(c) || c)}</span>`).join('') || '<span class="upd">—</span>';
      const typeLabel = t.maint_type === 'weekly' ? TX('weekly_op') : TX('monthly_mech');
      const meta = [t.mechanic ? (TX('col_by') + ' ' + esc(t.mechanic)) : '', t.line ? (TX('line') + ' ' + esc(t.line)) : '', typeLabel].filter(Boolean).join(' · ');
      return `<tr>
        <td><div style="font-weight:600">${t.date_done ? esc(t.date_done) : (t.task ? esc(t.task) : '—')}</div>${meta ? `<div class="upd">${meta}</div>` : ''}${t.notes ? `<div class="upd">${esc(t.notes)}</div>` : ''}</td>
        <td>${chips}</td>
        <td class="${dueClass}">${t.next_due ? esc(t.next_due) + dueNote : '—'}</td>
        <td class="row-actions">
          <button class="icon-btn" data-edit="${t.id}" title="Edit">✎</button>
          <button class="icon-btn" data-del="${t.id}" title="Delete">🗑</button>
        </td></tr>`;
    }).join('') + `</tbody></table>`;
  b.querySelectorAll('[data-edit]').forEach(x => x.onclick = () => openTask(+x.dataset.edit));
  b.querySelectorAll('[data-del]').forEach(x => x.onclick = () => delTask(+x.dataset.del));
}

function taskSheetMarkup() {
  return `<div class="backdrop" id="task-sheet"><div class="sheet">
    <div class="sheet-head"><h3 id="task-title">${TX('add_maint')}</h3><button class="x" id="task-close">×</button></div>
    <div class="field"><label>${TX('date_done')}</label><input id="t-date" type="date"></div>
    <div class="field two">
      <div><label>${TX('type')}</label><select id="t-type" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:8px">
        <option value="monthly">${TX('monthly_mech')}</option>
        <option value="weekly">${TX('weekly_op')}</option>
      </select></div>
      <div><label>${TX('line')}</label><select id="t-line" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:8px"></select></div>
    </div>
    <div class="field"><label>${TX('mechanic')}</label><input id="t-mech" placeholder="${TX('ph_mech')}"></div>
    <div class="field"><label>${TX('checks_done')}</label><div id="t-checks" class="check-grid"></div></div>
    <div class="field"><label>${TX('remarks')}</label><textarea id="t-notes" rows="2"></textarea></div>
    <div class="field"><label>${TX('next_due_opt')}</label><input id="t-next" type="date"></div>
    <div class="actions"><button class="btn btn-primary" id="t-save">${TX('save_record')}</button></div>
  </div></div>`;
}

// Older records stored the combined 'clean_oil'. When one is opened for
// editing, expand it into the two new items so nothing is lost on save.
function normalizeChecks(arr) {
  const out = new Set();
  (Array.isArray(arr) ? arr : []).forEach(c => {
    if (c === 'clean_oil') { out.add('clean'); out.add('oil_change'); }
    else out.add(c);
  });
  return out;
}

function buildCheckGrid() {
  const g = $('t-checks'); if (!g) return;
  g.innerHTML = CHECK_ITEMS.map(({ id, key }) =>
    `<div class="check-item${taskChecks.has(id) ? ' on' : ''}" data-check="${id}"><span class="box">${taskChecks.has(id) ? '✓' : ''}</span>${esc(TX(key))}</div>`
  ).join('');
  g.querySelectorAll('[data-check]').forEach(el => el.onclick = () => {
    const id = el.dataset.check;
    if (taskChecks.has(id)) taskChecks.delete(id); else taskChecks.add(id);
    buildCheckGrid();
  });
}

// Build the Line dropdown. Keeps any legacy free-text value so editing never loses data.
function buildLineSelect(current) {
  const sel = $('t-line'); if (!sel) return;
  const opts = LINE_OPTIONS.slice();
  if (current && !opts.includes(current)) opts.unshift(current);
  sel.innerHTML = `<option value="">${TX('line_select')}</option>` +
    opts.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  sel.value = current || '';
}

function openTask(id) {
  editingTaskId = id;
  const t = id ? TASKS.find(x => x.id === id) : null;
  $('task-title').textContent = t ? TX('edit_maint') : TX('add_maint');
  $('t-date').value = t ? (t.date_done || '') : stamp(); // new records default to today
  $('t-type').value = t ? (t.maint_type || 'monthly') : 'monthly';
  buildLineSelect(t ? (t.line || '') : '');
  const who = store.get().who;
  $('t-mech').value = t ? (t.mechanic || who || '') : (who || '');
  $('t-notes').value = t ? (t.notes || '') : '';
  $('t-next').value = t ? (t.next_due || '') : '';
  taskChecks = normalizeChecks(t && t.checks);
  buildCheckGrid();
  $('task-sheet').classList.add('open');
}

function wireTaskSheet() {
  const addBtn = $('add-task'); if (addBtn) addBtn.onclick = () => openTask(null);
  const closeBtn = $('task-close'); if (closeBtn) closeBtn.onclick = () => $('task-sheet').classList.remove('open');
  const saveBtn = $('t-save');
  if (saveBtn) saveBtn.onclick = async () => {
    const m = store.get().current; if (!m) return;
    const date_done = $('t-date').value || null;
    if (!date_done) { toast(TX('m_task_req'), 'err'); return; }
    const rec = {
      machine_code: m.code, date_done, maint_type: $('t-type').value, line: $('t-line').value || null,
      mechanic: $('t-mech').value.trim() || null, checks: [...taskChecks],
      next_due: $('t-next').value || null, notes: $('t-notes').value.trim() || null,
      task: 'Maintenance', updated_at: new Date().toISOString(), updated_by: store.get().who || null,
    };
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    const res = await saveTask(editingTaskId, rec);
    saveBtn.disabled = false; saveBtn.textContent = TX('save_record');
    if (res.error) { toast('Save failed: ' + res.error.message, 'err'); return; }
    $('task-sheet').classList.remove('open');
    await loadTasks(m.code);
    toast(TX('m_saved'), 'ok');
  };
}

async function delTask(id) {
  const m = store.get().current; if (!m) return;
  const t = TASKS.find(x => x.id === id); if (!t) return;
  if (!confirm('Delete this maintenance record?')) return;
  const { error } = await deleteTask(id);
  if (error) { toast('Delete failed: ' + error.message, 'err'); return; }
  await loadTasks(m.code);
  toast(TX('m_deleted'), 'ok');
}
