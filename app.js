const $ = (id) => document.getElementById(id);
const CAPTURE_RANGE_METRES = 20;
const TARGET_COUNT = 3;
let position = null;
let gpsWatch = null;
let targets = [];
let selectedTarget = 0;
let walkedMetres = 0;
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
  const target = targets[selectedTarget];
  const distance = position && target ? Math.round(distanceBetween(position, target)) : null;
  const bearing = position && target ? bearingBetween(position, target) : null;
  const gain = distance === null ? 0 : Math.max(1, Math.round(12 * (1 - Math.min(distance, 300) / 300)));
  $('gain-percent').textContent = Math.round(gain / 12 * 100);
  $('gain-count').textContent = `${Math.floor(gain)} / 12 SEGMENTS`;
  $('gain-bars').innerHTML = Array.from({ length: 12 }, (_, i) => `<i class="${i < gain ? 'on' : ''}"></i>`).join('');
  const distanceLabel = distance === null ? '—' : `${distance}m`;
  $('contact-distance').textContent = distanceLabel;
  $('radar-distance').textContent = distance === null ? '—' : distance;
  $('radius-number').textContent = position ? Math.max(5, Math.round(position.accuracy || 5)) : '—';
  $('map-distance').textContent = distance === null ? '—' : distance;
  $('capture-distance').textContent = distance === null ? '—' : distance;
  const radarTarget = $('radar-target');
  const relative = bearing === null ? 45 : bearing;
  const radians = relative * Math.PI / 180;
  radarTarget.style.left = `${50 + Math.sin(radians) * 27}%`;
  radarTarget.style.top = `${50 - Math.cos(radians) * 27}%`;
  $('bearing-text').textContent = bearing === null ? '—' : `${String(Math.round(bearing)).padStart(3, '0')}° ${compassPoint(bearing)}`;
  $('telemetry-behaviour').textContent = distance !== null && distance <= CAPTURE_RANGE_METRES ? 'HEARTH WISP // EMERGING' : 'DOMOVOY // SHY & WATCHFUL';
  $('lock-percent').textContent = `${Math.min(100, lock)}%`;
  if (distance !== null) $('poi-distance').textContent = `${distance}m · ${compassPoint(bearing)}`;
  if (distance !== null) $('contact-distance').textContent = `${distance}m`;
  document.querySelectorAll('.contact').forEach((button, i) => {
    button.classList.toggle('selected', i === selectedTarget);
    button.querySelector('b').textContent = position && targets[i] ? `${Math.round(distanceBetween(position, targets[i]))}m` : '—';
  });
  document.querySelectorAll('.map-signal').forEach((mapSignal, i) => {
    const contact = position && targets[i] ? targets[i] : null;
    if (!contact) { mapSignal.style.opacity = '0'; return; }
    const targetBearing = bearingBetween(position, contact) * Math.PI / 180;
    const targetDistance = distanceBetween(position, contact);
    const mapRadius = Math.min(targetDistance, 250) / 250 * 34;
    mapSignal.style.left = `${50 + Math.sin(targetBearing) * mapRadius}%`;
    mapSignal.style.top = `${55 - Math.cos(targetBearing) * mapRadius}%`;
    mapSignal.style.opacity = '1';
  });
}
function distanceBetween(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function bearingBetween(a, b) {
  const rad = Math.PI / 180;
  const lat1 = a.latitude * rad;
  const lat2 = b.latitude * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  return (Math.atan2(Math.sin(dLon) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)) / rad + 360) % 360;
}
function compassPoint(degrees) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
}
function destination(from, bearing, metres) {
  const rad = Math.PI / 180;
  const angular = metres / 6371000;
  const brng = bearing * rad;
  const lat1 = from.latitude * rad;
  const lon1 = from.longitude * rad;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
  return { latitude: lat2 / rad, longitude: ((lon2 / rad + 540) % 360) - 180 };
}
function setGPSStatus(message, state) {
  const status = $('gps-status');
  status.innerHTML = `<i></i> GPS: ${message} <span>•</span> ${targets.length || TARGET_COUNT} ACTIVE SIGNALS`;
  status.dataset.state = state;
  $('map-engine-status').textContent = state === 'locked' ? 'MAP ENGINE // LIVE GPS' : `MAP ENGINE // ${message}`;
  $('zone-status').textContent = state === 'locked' ? 'SIGNALS ACTIVE' : state.toUpperCase();
  $('gps-control').title = state === 'locked' ? 'Recenter on your GPS location' : 'Enable GPS';
}
function spawnTargets(origin) {
  if (targets.length) return;
  const bearings = [Math.random() * 360, Math.random() * 360, Math.random() * 360];
  const ranges = [30 + Math.random() * 40, 100 + Math.random() * 55, 170 + Math.random() * 70];
  targets = bearings.map((bearing, i) => destination(origin, bearing, ranges[i]));
  $('active-signal-count').textContent = TARGET_COUNT;
  document.querySelectorAll('.contact').forEach((button, i) => {
    const d = Math.round(distanceBetween(origin, targets[i]));
    button.querySelector('b').textContent = `${d}m`;
  });
}
function onPosition(fix) {
  const next = { latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy };
  if (position && next.accuracy <= 35) {
    const step = distanceBetween(position, next);
    if (step > Math.max(position.accuracy || 0, next.accuracy || 0) * .7 && step < 100) walkedMetres += step;
  }
  position = next;
  spawnTargets(position);
  const accuracy = Math.round(next.accuracy);
  setGPSStatus(accuracy <= 35 ? `LOCKED ±${accuracy}M` : `WEAK ±${accuracy}M`, accuracy <= 35 ? 'locked' : 'weak');
  $('location-accuracy').textContent = `GPS accuracy ±${accuracy}m · walked ${(walkedMetres / 1000).toFixed(2)} km`;
  $('coordinate-readout').textContent = `${next.latitude.toFixed(5)}°, ${next.longitude.toFixed(5)}° · on this device only`;
  renderSignal();
  updateCapture();
}
function gpsError(error) {
  if (gpsWatch !== null) navigator.geolocation.clearWatch(gpsWatch);
  gpsWatch = null;
  const messages = { 1: 'PERMISSION DENIED', 2: 'POSITION UNAVAILABLE', 3: 'GPS TIMED OUT' };
  const message = messages[error.code] || 'GPS UNAVAILABLE';
  setGPSStatus(message, 'error');
  $('location-accuracy').textContent = error.code === 1 ? 'Allow location access in your browser or device settings, then retry.' : 'Check location services and signal, then retry GPS.';
  notify(`${message} · ${$('location-accuracy').textContent}`);
}
function startGPS() {
  if (!('geolocation' in navigator)) { setGPSStatus('NOT SUPPORTED', 'error'); notify('This browser does not support GPS location'); return; }
  if (!window.isSecureContext) { setGPSStatus('SECURE CONNECTION REQUIRED', 'error'); $('location-accuracy').textContent = 'GPS works on HTTPS or localhost. Open the app through a secure connection.'; notify('Open The Hunt over HTTPS to enable GPS'); return; }
  if (gpsWatch !== null) { if (position) notify('GPS is live · follow the signal distance and bearing'); return; }
  setGPSStatus('REQUESTING PERMISSION', 'waiting');
  $('location-accuracy').textContent = 'Waiting for device location permission…';
  gpsWatch = navigator.geolocation.watchPosition(onPosition, gpsError, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
}
function updateCapture() {
  const target = targets[selectedTarget];
  const distance = position && target ? Math.round(distanceBetween(position, target)) : null;
  const located = Boolean(position && target && position.accuracy <= 35 && distance <= CAPTURE_RANGE_METRES);
  const scene = document.querySelector('.ar-scene');
  scene.classList.toggle('target-located', located);
  $('capture-distance').textContent = distance === null ? '—' : distance;
  const alert = document.querySelector('.target-alert');
  alert.firstChild.textContent = located ? '● TARGET LOCATED — ' : '● SIGNAL RANGE — ';
  $('lock-percent').textContent = `${Math.min(lock, 100)}%`;
  $('capture-creature').style.transform = `translate(-50%,-50%) scale(${1 + Math.max(0, 1 - (distance || 250) / 250) * .2})`;
}
function advanceHunt() {
  if (!position) { startGPS(); return; }
  renderSignal();
  notify(targets[selectedTarget] ? 'Signal refreshed · follow the bearing and distance' : 'Waiting for your first GPS fix');
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
  discoveries.unshift({ name: 'Domovoy', form: 'Hearth Wisp', date: new Date().toISOString(), distance: walkedMetres });
  saveDiscoveries();
  $('discovery-modal').classList.remove('open');
  lock = 42;
  targets = [];
  if (position) spawnTargets(position);
  renderJournal();
  switchScreen('journal');
  notify('Domovoy archived in your field journal');
}

document.querySelectorAll('.bottom-nav button').forEach((button) => button.addEventListener('click', () => switchScreen(button.dataset.screen)));
$('advance-hunt').addEventListener('click', advanceHunt);
$('open-capture').addEventListener('click', () => {
  if (!position) { startGPS(); return; }
  switchScreen('capture');
});
$('back-to-scanner').addEventListener('click', () => switchScreen('scanner'));
document.querySelectorAll('.contact').forEach((button) => button.addEventListener('click', () => {
  selectedTarget = Array.from(document.querySelectorAll('.contact')).indexOf(button);
  document.querySelectorAll('.contact').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  renderSignal();
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
  const distance = position && targets[selectedTarget] ? distanceBetween(position, targets[selectedTarget]) : Infinity;
  if (!position) { startGPS(); return; }
  if (position.accuracy > 35) {
    notify('GPS accuracy is too low · wait for a clearer location fix');
    return;
  }
  if (distance > CAPTURE_RANGE_METRES) {
    notify(`Too far to capture · move within ${CAPTURE_RANGE_METRES}m of the signal`);
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
  startGPS();
});
$('gps-control').addEventListener('click', startGPS);

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
