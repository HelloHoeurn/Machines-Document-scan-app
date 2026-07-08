// Minimal view router + cross-view navigation.
import { store } from './store.js';

const VIEWS = ['view-list', 'view-dashboard', 'view-qrprint', 'view-detail'];

export function navigate(view) {
  VIEWS.forEach(v => document.getElementById(v)?.classList.toggle('hidden', v !== ('view-' + view) && v !== view));
  document.querySelectorAll('#topnav button').forEach(b => b.classList.toggle('active', b.dataset.nav === view));
}

/** Jump to a machine's passport from anywhere (e.g. the dashboard). */
export async function gotoMachine(code) {
  navigate('list');
  const { openMachine } = await import('./components/machinePassport.js');
  openMachine(code);
}
