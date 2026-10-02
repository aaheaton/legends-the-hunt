const $ = (id) => document.getElementById(id);
const distances = [146, 118, 92, 61, 42, 22, 8];
let approach = 0;
let lock = 42;
let discoveries = readDiscoveries();
let toastTimer;

function readDiscoveries() {
  try { return JSON.parse(localStorage.getItem('hunt-journal') || '[]'); }
  catch { return []; }
}
function saveDiscoveries() { localStorage.setItem('hunt-journal', JSON.stringify(discoveries)); }
function notify(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}
function switchScreen(screen) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.id === `${screen}-view`));
  document.querySelectorAll('.bottom-nav button').forEach((el) => el.classList.toggle('active', el.dataset.screen === screen));
  if (screen === 'capture') updateCapture();
  if (screen === 'journal') renderJournal();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderSignal() {
  const distance = distances[approach];
  const gain = Math.min(12, 3 + approach * 1.5);
  $('gain-percent').textContent = Math.round(gain / 12 * 100);
  $('gain-count').textContent = `${Math.floor(gain)} / 12 SEGMENTS`;
  $('gain-bars').innerHTML = Array.from({ length: 12 }, (_, i) => `<i class="${i < gain ? 'on' : ''}"></i>`).join('');
  $('contact-distance').textContent = `${distance}m`;
  $('radar-distance').textContent = distance;
  $('radius-number').textContent = Math.max(4, Math.round(distance * .16));
  $('map-distance').textContent = distance;
  $('capture-distance').textContent = distance;
  const target = $('radar-target');
  const progress = approach / (distances.length - 1);
  target.style.left = `${68 - progress * 15}%`;
  target.style.top = `${37 + progress * 13}%`;
  $('bearing-text').textContent = approach > 3 ? '062° E-NE' : '038° N-NE';
  $('telemetry-behaviour').textContent = approach > 4 ? 'HEARTH WISP // EMERGING' : 'DOMOVOY // SHY & WATCHFUL';
  $('lock-percent').textContent = `${Math.min(100, lock)}%`;
}
function updateCapture() {
  $('capture-distance').textContent = distances[approach];
  $('lock-percent').textContent = `${Math.min(lock, 100)}%`;
  $('capture-creature').style.transform = `translate(-50%,-50%) scale(${1 + approach * .025})`;
}
function advanceHunt() {
  if (approach < distances.length - 1) {
    approach++;
    renderSignal();
    notify(approach === distances.length - 1 ? 'Signal acquired · target within capture range' : 'Sonar pulse received · signal getting stronger');
  } else {
    switchScreen('capture');
    notify('You are close enough to search');
  }
}
function openDiscovery() { $('discovery-modal').classList.add('open'); }
function renderJournal() {
  const total = 6 + discoveries.length;
  $('journal-total').textContent = total;
  $('journal-uncommon').textContent = 1 + discoveries.length;
  const roster = [
    { name: 'Domovoy', form: 'Hearth Wisp', note: 'HEARTH SPIRIT // STAGE I', art: 'assets/domovoy/stage-1.png' },
    { name: 'Leprechaun', form: 'Barrow Keeper', note: 'BARROW FAE // STAGE I', art: 'assets/leprechaun/stage-1.png' },
    { name: 'Blue Men of the Minch', form: 'Storm Caller', note: 'SEA FAE // STAGE I', art: 'assets/blue-men-of-the-minch/stage-1.png' },
    { name: 'Wulver', form: 'Hearth Wulver', note: 'WOLF FOLK // STAGE I', art: 'assets/wulver/stage-1.png' },
    { name: 'Naga', form: 'Lotus Coil Serpens', note: 'SERPENT SPIRIT // STAGE I', art: 'assets/naga/stage-1.png' },
    { name: 'Rusalka', form: 'Drowned Willow', note: 'WATER WRAITH // STAGE I', art: 'assets/rusalka/stage-1.png' }
  ];
  const cards = roster.map(({ name, form, note, art }) =>
    `<article class="journal-card"><span class="rarity">◆ UNCOMMON</span><div class="emoji"><img src="${art}" alt="${name}, ${form}" loading="lazy"></div><small>${note}</small><b>${name}</b></article>`
  );
  $('specimen-grid').innerHTML = cards.join('');
}
function addDiscovery() {
  discoveries.unshift({ name: 'Domovoy', form: 'Hearth Wisp', date: new Date().toISOString() });
  saveDiscoveries();
  $('discovery-modal').classList.remove('open');
  lock = 100;
  renderJournal();
  switchScreen('journal');
  notify('Domovoy archived in your field journal');
}

document.querySelectorAll('.bottom-nav button').forEach((button) => button.addEventListener('click', () => switchScreen(button.dataset.screen)));
$('advance-hunt').addEventListener('click', advanceHunt);
$('open-capture').addEventListener('click', () => switchScreen('capture'));
$('back-to-scanner').addEventListener('click', () => switchScreen('scanner'));
document.querySelectorAll('.contact').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.contact').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  notify('Signal selected · tracking active');
}));
document.querySelectorAll('.zone-filters button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.zone-filters button').forEach((item) => item.classList.remove('chosen'));
  button.classList.add('chosen');
}));
$('fallback-toggle').addEventListener('click', (event) => event.currentTarget.classList.toggle('on'));
document.querySelectorAll('.capsule').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.capsule').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
}));
$('capture-now').addEventListener('click', () => {
  if (distances[approach] > 22) {
    notify('Target is too far · follow the signal closer');
    return;
  }
  lock = Math.min(lock + 30, 100);
  updateCapture();
  if (lock >= 100) openDiscovery();
  else notify(`Capture pulse deployed · lock ${lock}%`);
});
$('close-modal').addEventListener('click', () => $('discovery-modal').classList.remove('open'));
$('discovery-modal').addEventListener('click', (event) => { if (event.target === $('discovery-modal')) $('discovery-modal').classList.remove('open'); });
$('journal-discovery').addEventListener('click', addDiscovery);
$('infuse').addEventListener('click', () => notify('Hearth Sentinel needs 3 ember fragments · Ancestral Guardian needs 5'));
document.querySelectorAll('.stage-node').forEach((node) => node.addEventListener('click', () => {
  if (node.dataset.stage === '1') notify('Hearth Wisp · first form discovered');
  else notify(node.dataset.stage === '2' ? 'Hearth Sentinel is sealed · collect 3 ember fragments' : 'Ancestral Guardian is sealed · collect 5 ember fragments');
}));
renderSignal();
renderJournal();

const welcomeScreen = $('welcome-screen');
$('start-hunting').addEventListener('click', () => {
  welcomeScreen.classList.add('welcome-dismissed');
  window.setTimeout(() => welcomeScreen.remove(), 240);
});

let pendingInstallPrompt;
const installButton = $('install-app');
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  pendingInstallPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!pendingInstallPrompt) return;
  pendingInstallPrompt.prompt();
  await pendingInstallPrompt.userChoice;
  pendingInstallPrompt = null;
  installButton.hidden = true;
});
window.addEventListener('appinstalled', () => {
  installButton.hidden = true;
  notify('The Hunt is ready on your device');
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.error('The Hunt could not register offline support:', error);
    });
  }, { once: true });
}
