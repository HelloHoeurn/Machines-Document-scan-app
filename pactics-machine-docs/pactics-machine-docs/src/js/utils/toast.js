// Toast notifications. Call mountToast() once at boot.
let elToast, timer;
export function mountToast() {
  elToast = document.getElementById('toast');
  if (!elToast) { elToast = document.createElement('div'); elToast.id = 'toast'; document.body.appendChild(elToast); }
}
export function toast(msg, type = 'ok') {
  if (!elToast) mountToast();
  elToast.textContent = msg;
  elToast.className = 'toast show ' + type;
  clearTimeout(timer);
  timer = setTimeout(() => { elToast.className = 'toast'; }, 2600);
}
