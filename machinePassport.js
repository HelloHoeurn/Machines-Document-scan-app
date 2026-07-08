// Machine detail (passport) view.
// Photo strategy, in priority order:
//   1) machine.image_url (a saved, permanent photo)          -> show it
//   2) a reference image in OUR OWN storage by brand/model   -> show it (display-only)
//   3) a type-based blueprint schematic (always available)   -> looks populated instantly
// A manual upload or a dropped URL always overrides and is saved to Supabase.
import { store } from '../store.js';
import { sb } from '../supabaseClient.js';
import { SUPABASE_URL, TABLES } from '../config.js';
import { TX } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { toast } from '../utils/toast.js';
import { $ } from '../utils/dom.js';

const PHOTO_BUCKET = 'catalogs';
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

// ---- Option B: clean blueprint line-art, chosen by machine type ----
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

// ---- Photo cell markup ----
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

  try { new window.QRCode($('qr'), { text: qrLink(m.code), width: 110, height: 110, correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) {}

  $('back').onclick = async () => { const { navigate } = await import('../router.js'); navigate('list'); };
  $('print-qr').onclick = async () => { try { const mod = await import('./qrPrint.js'); mod.printQR?.(m); } catch (e) { toast('Print view not ported yet', 'err'); } };

  wirePhotoCell();
  if (!m.image_url) tryReferenceImage(m); // Option A (safe): our own storage
}

// ---- Interactions: click-to-upload + drag/drop (file OR url) ----
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

// ---- Option A helper: look for OUR OWN reference image by brand/model ----
const loadable = (url) => new Promise((res) => { const im = new Image(); im.onload = () => res(true); im.onerror = () => res(false); im.src = url; });

async function tryReferenceImage(m) {
  if (!m.brand && !m.model) return;
  const bp = $('pphoto') && $('pphoto').querySelector('.bpwrap');
  if (!bp) return; // a real image is already showing
  const key = [m.brand, m.model].filter(Boolean).join('/').replace(/[^\w./-]+/g, '_');
  const base = `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/machine-refs/${key}`;
  for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
    if (store.get().current?.code !== m.code) return;             // navigated away
    if (await loadable(base + ext)) {
      const still = $('pphoto') && $('pphoto').querySelector('.bpwrap');
      if (still) { const img = document.createElement('img'); img.src = base + ext; img.alt = m.code; still.replaceWith(img); }
      return;
    }
  }
}

// ---- Manual actions override the auto states AND persist to Supabase ----
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
