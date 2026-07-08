// Machine detail (passport) view.
// Renders the top card — machine photo (with placeholder + click-to-upload),
// details, and QR — plus the section shells for catalog / parts / maintenance.
import { store } from '../store.js';
import { sb } from '../supabaseClient.js';
import { SUPABASE_URL, TABLES } from '../config.js';
import { TX } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import { $ } from '../utils/dom.js';

const PHOTO_BUCKET = 'catalogs';                 // existing public bucket
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

const CAMERA_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
  'stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/>' +
  '<path d="m4 17 4.5-4.5 3 3L16 11l4 5"/></svg>';

/** The photo thumbnail: real image if present, otherwise the placeholder. */
function photoBlock(m) {
  const inner = m.image_url
    ? `<img src="${esc(m.image_url)}" alt="${esc(m.code)}">`
    : `<div class="ph">${CAMERA_ICON}<span>${TX('no_image')}</span></div>`;
  const hint = TX(m.image_url ? 'change_photo' : 'add_photo');
  return `<div class="pphoto" id="pphoto" title="${hint}">${inner}<div class="edithint">${hint}</div></div>`;
}

const qrLink = (code) => location.origin + location.pathname + '?m=' + encodeURIComponent(code);

/** Open a machine's passport. Called by router.gotoMachine and the list view. */
export function openMachine(code) {
  const m = store.get().machines.find(x => x.code === code);
  if (!m) { toast('Machine ' + code + ' not found', 'err'); return; }
  store.set({ current: m });

  document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
  const view = $('view-detail');
  view.classList.remove('hidden');
  window.scrollTo(0, 0);

  view.innerHTML = `
    <div class="detail-top"><span class="back" id="back">← ${TX('all_machines')}</span></div>

    <div class="passport" id="passport">
      ${photoBlock(m)}
      <div class="pinfo">
        <div class="pcode">${esc(m.code)}</div>
        <div class="pmeta">${esc(m.machine_type || '')}${m.brand ? ' · ' + esc(m.brand) : ''}${m.model ? ' · ' + esc(m.model) : ''}</div>
        <div class="pmeta">${m.serial ? 'Serial ' + esc(m.serial) : ''}${m.fixed_asset ? ' · FA ' + esc(m.fixed_asset) : ''}</div>
      </div>
      <div class="qr-wrap"><div class="qrbox" id="qr"></div><div class="lbl">${esc(m.code)}</div>
        <button class="btn btn-secondary btn-sm" id="print-qr" style="margin-top:8px">${TX('print_qr')}</button>
      </div>
    </div>

    <div class="doc-section"><div class="sec-head"><h2>${TX('catalog_manuals')}</h2></div><div id="docs-body"></div></div>
    <div class="doc-section"><div class="sec-head"><h2>${TX('spare_parts')}</h2></div><div id="parts-body"></div></div>
    <div class="doc-section"><div class="sec-head"><h2>${TX('maint_schedule')}</h2></div><div id="maint-body"></div></div>`;

  // QR (library on window, loaded via CDN in index.html)
  try { new window.QRCode($('qr'), { text: qrLink(m.code), width: 110, height: 110, correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) {}

  $('back').onclick = async () => { const { navigate } = await import('../router.js'); navigate('list'); };
  $('print-qr').onclick = async () => { try { const mod = await import('./qrPrint.js'); mod.printQR?.(m); } catch (e) { toast('Print view not ported yet', 'err'); } };

  // ── Machine photo: click anywhere on the thumbnail to upload ──
  const photoEl = $('pphoto');
  if (photoEl) photoEl.onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => uploadMachinePhoto(inp.files[0]);
    inp.click();
  };

  // TODO: once ported, call renderDocs(), renderParts(), renderTasks() here.
}

/** Upload a photo to Storage, save its URL on the machine, re-render. */
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

  const url = `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${up.data.path}`;
  const upd = await sb.from(TABLES.machines).update({ image_url: url }).eq('code', m.code);
  if (upd.error) { toast('Photo uploaded, but linking failed — add a machines UPDATE policy. (' + upd.error.message + ')', 'err'); return; }

  m.image_url = url;
  const inList = store.get().machines.find(x => x.code === m.code);
  if (inList) inList.image_url = url;
  store.set({ current: m });
  toast(TX('photo_updated'), 'ok');
  openMachine(m.code);
}
