// In-app QR scanner (getUserMedia + jsQR, BarcodeDetector fallback)
// ─────────────────────────────────────────────────────────────────────────
// SCAFFOLD STUB. The original logic lives in Machine_Documents_app.html.
// Port it here following the Dashboard vertical as the reference pattern:
//   • replace globals with `store` (import from '../store.js')
//   • replace $, esc, toast, TX with the util/i18n imports
//   • export the render/handler functions this view needs
//
// Source functions: openScanner 2592, startScan 2604, startDecodeLoop 2705, handleDecoded 2762,
//   stopScan 2767, codeFromScan 2565, normCode 2779, findByScan 2780, openFromScan 2794, resolveScan 2803,
//   showScanBtns 2580. Keep jsQR as the always-on decoder; BarcodeDetector as optional bonus.
//   jsQR is loaded on window via <script> in index.html (or import an ESM build).
export function mount() { /* TODO: implement (see notes above) */ }
