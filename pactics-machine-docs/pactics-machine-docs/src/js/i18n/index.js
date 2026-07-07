// i18n runtime: language state + translation + DOM application.
import { I18N } from './dictionary.js';
import { store } from '../store.js';
import { CHECK_ITEMS } from '../config.js';

export function TX(key) {
  const lang = store.get().lang;
  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
}
export const CHECK_LABEL = (id) => {
  const item = CHECK_ITEMS.find(c => c.id === id);
  return item ? TX(item.key) : id;
};
export function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(elm => { elm.textContent = TX(elm.dataset.i18n); });
  document.documentElement.lang = store.get().lang;
}
export function setLang(lang) {
  store.set({ lang });
  localStorage.setItem('docs_lang', lang);
  applyLang();
}
export function toggleLang() { setLang(store.get().lang === 'en' ? 'km' : 'en'); }
