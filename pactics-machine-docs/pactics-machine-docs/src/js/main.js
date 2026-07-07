// Application bootstrap.
import { store } from './store.js';
import { applyLang, toggleLang, TX } from './i18n/index.js';
import { mountToast, toast } from './utils/toast.js';
import { navigate } from './router.js';
import { loadMachines } from './data/machines.js';
import { loadDashboard } from './components/dashboard.js';
import { wireExports } from './components/exports.js';

function wireChrome() {
  document.querySelectorAll('#topnav button').forEach(b => {
    b.onclick = async () => {
      const view = b.dataset.nav;
      navigate(view);
      if (view === 'dashboard') await loadDashboard();
      // TODO: else if (view === 'list') renderList();  (see components/machineList.js)
      // TODO: else if (view === 'qrprint') initQrPrint(); (see components/qrPrint.js)
    };
  });
  const lang = document.getElementById('lang-btn');
  if (lang) lang.onclick = () => { toggleLang(); lang.textContent = store.get().lang === 'en' ? 'ខ្មែរ' : 'EN'; };
  const scan = document.getElementById('scan-btn');
  if (scan) scan.onclick = async () => { /* const { openScanner } = await import('./components/qrScanner.js'); openScanner(); */ toast('Scanner: port qrScanner.js', 'err'); };
  const who = document.getElementById('setname-btn');
  if (who) who.onclick = () => {
    const v = prompt(TX('setName'), store.get().who || '');
    if (v != null) { store.set({ who: v.trim() }); localStorage.setItem('docs_who', v.trim()); }
  };
}

async function boot() {
  mountToast();
  applyLang();
  wireChrome();
  wireExports();
  try {
    await loadMachines();
    navigate('dashboard');
    await loadDashboard();
  } catch (err) {
    console.error(err);
    toast('Load failed — check Supabase connection', 'err');
  }
}
document.addEventListener('DOMContentLoaded', boot);
