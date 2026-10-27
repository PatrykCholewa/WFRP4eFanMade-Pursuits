import { migrateLegacyData } from "../migration.js";
import {ID, initialState, transition, position, lengthOf, formatTime, validPath, copy, clamp} from './core.js';
import {TimelineEngine} from './engine.js';

let engine, state, panel, controllerQueue = Promise.resolve(), message = 'Gotowy', lastPreload = 0;
const clock = () => game.time.serverTime;
const controlsAllowed = () => game.user.isGM && game.users.activeGM?.id === game.user.id;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notice = error => { console.error(`[${ID}]`, error); ui.notifications.error(error.message ?? String(error)); };

function report(text, error = false) {
  message = text;
  if (error) { console.error(`[${ID}] ${text}`); ui.notifications.warn(`Wspólny czas: ${text}`); }
  updateClock();
}
function receive(value) {
  if (!engine) return;
  if (state && value.revision <= state.revision) return;
  const changedTracks = JSON.stringify(state?.tracks) !== JSON.stringify(value.tracks);
  state = copy(value);
  void engine.accept(state);
  if (changedTracks) engine.prune(state.tracks);
  if (state.preload !== lastPreload) {
    lastPreload = state.preload;
    void engine.preload(state.tracks).then(failures => report(failures.length ? `Błędy wczytywania: ${failures.join(', ')}` : 'Pliki wczytane na tym komputerze'));
  }
  refresh();
}
function command(action) {
  const task = async () => {
    if (!controlsAllowed()) throw new Error('Transportem steruje aktualnie główny aktywny MG.');
    const latest = game.settings.get(ID, 'transport');
    const next = transition(latest, action, clock());
    await game.settings.set(ID, 'transport', next);
    receive(next); // Also works if the local onChange hook already ran.
  };
  const result = controllerQueue.catch(() => {}).then(task);
  controllerQueue = result;
  return result;
}
function launchButton() {
  if (document.getElementById('sta-launch')) return;
  const button = document.createElement('button');
  button.id = 'sta-launch'; button.type = 'button'; button.textContent = '♫';
  button.title = 'Wspólny czas — muzyka (Ctrl+Shift+M)';
  button.setAttribute('aria-label', button.title);
  button.addEventListener('click', open);
  document.body.append(button);
}
function open() {
  if (panel) { panel.hidden = false; refresh(); return; }
  panel = document.createElement('section'); panel.id = 'sta-panel';
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Wspólny czas — przełącznik muzyki');
  panel.innerHTML = `<header><div><strong>Wspólny czas</strong><small>Jedna ścieżka · jeden zegar</small></div><button type="button" data-action="close" title="Zamknij">✕</button></header>
    <div class="sta-body"><div class="sta-time"><output data-clock>0:00</output><span data-status></span></div>
    <input type="range" data-seek min="0" max="1" step="0.1" value="0" aria-label="Pozycja odtwarzania">
    <div class="sta-transport"><button type="button" data-action="play">▶ Odtwórz</button><button type="button" data-action="pause">Ⅱ Pauza</button><button type="button" data-action="stop">■ Stop</button><button type="button" data-action="resync">↻ Synchronizuj u mnie</button></div>
    <p class="sta-note" data-authority></p><div data-tracks class="sta-tracks"></div>
    <div class="sta-volumes"><label>Głośność dla wszystkich <input data-master type="range" min="0" max="100" step="1"></label><label>Głośność tylko u mnie <input data-local type="range" min="0" max="100" step="1"></label></div>
    <details data-config><summary>Pliki i ustawienia</summary>
      <p class="sta-note">Lista plików jest edytowalna po naciśnięciu Stop. Wybierz plik przez przeglądarkę Foundry; możesz tam także wgrać plik z komputera.</p>
      <form data-add><label>Nazwa <input name="name" type="text" maxlength="100" placeholder="np. Eksploracja"></label><label>Plik audio <span class="sta-path"><input name="path" type="text" placeholder="worlds/moj-swiat/audio/utwor.ogg" required><button type="button" data-action="browse">Wybierz / wgraj</button></span></label><button type="submit">＋ Dodaj ścieżkę</button></form>
      <div class="sta-import"><select data-playlist aria-label="Istniejąca playlista"></select><button type="button" data-action="import">Dodaj z playlisty</button></div>
      <form data-options><label><input name="loop" type="checkbox"> Zapętlaj wspólną oś czasu</label><label>Koniec osi (sekundy; 0 = najkrótszy plik)<input name="loopEnd" type="number" min="0" step="0.001"></label><label>Długość przejścia bez nakładania (ms)<input name="transitionMs" type="number" min="0" max="2000" step="10"></label><button type="submit">Zapisz ustawienia</button></form>
      <button type="button" data-action="preload">Wczytaj wszystkie pliki u połączonych graczy</button>
      <p class="sta-note">Całe nagrania są dekodowane do pamięci, aby dokładnie zapętlać wspólny zakres. Dłuższe końcówki są pomijane. Ścieżki mogą mieć różne długości; jednakowy czas nie wyrównuje melodii ani tempa.</p>
    </details><p class="sta-note">Ten odtwarzacz działa niezależnie od zwykłych playlist i Adaptive Audio. Zatrzymaj je, jeżeli nie chcesz dodatkowej muzyki.</p></div>`;
  document.body.append(panel);
  panel.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const {action, id} = button.dataset;
    void handle(action, id).catch(notice);
  });
  panel.querySelector('[data-add]').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void addTracks([{name: data.get('name'), path: data.get('path')}]).then(() => event.target.reset()).catch(notice);
  });
  panel.querySelector('[data-options]').addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void command({type:'options', loop:data.has('loop'), loopEnd:Number(data.get('loopEnd')), transitionMs:Number(data.get('transitionMs'))}).catch(notice);
  });
  panel.querySelector('[data-seek]').addEventListener('change', event => { void command({type:'seek', seconds:Number(event.target.value)}).catch(notice); });
  panel.querySelector('[data-master]').addEventListener('change', event => { void command({type:'volume', value:Number(event.target.value)/100}).catch(notice); });
  panel.querySelector('[data-local]').addEventListener('input', event => {
    const value = Number(event.target.value)/100;
    engine.localOverride = value;
    if (engine.current) void engine.current.sound.fade(state.volume * value, {duration:30});
  });
  panel.querySelector('[data-local]').addEventListener('change', event => { void game.settings.set(ID, 'localVolume', Number(event.target.value)/100); });
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { panel.hidden = true; event.stopPropagation(); } });
  refresh();
}
async function handle(action, id) {
  if (action === 'close') { panel.hidden = true; return; }
  if (action === 'resync') { engine.failed = false; await engine.accept(state); return; }
  if (action === 'browse') {
    if (!controlsAllowed()) return;
    const field = panel.querySelector('[name="path"]');
    const picker = new foundry.applications.apps.FilePicker({type:'audio', current:field.value,
      callback:path => { field.value = path; }});
    picker.render(true); return;
  }
  if (action === 'remove') { await command({type:'tracks', tracks:state.tracks.filter(t => t.id !== id)}); return; }
  if (action === 'import') {
    const list = game.playlists.get(panel.querySelector('[data-playlist]').value);
    if (!list) throw new Error('Wybierz istniejącą playlistę.');
    await addTracks(list.sounds.map(s => ({name:s.name, path:s.path}))); return;
  }
  if (action === 'select') { await command({type:'select', id}); return; }
  await command({type:action});
}
let adding = false;
async function addTracks(inputs) {
  if (!controlsAllowed()) throw new Error('Tylko główny aktywny MG może dodawać pliki.');
  if (state.status !== 'stopped') throw new Error('Najpierw naciśnij Stop.');
  if (adding) throw new Error('Trwa wczytywanie poprzednich plików.');
  if (state.tracks.length + inputs.length > 20) throw new Error('Ten zestaw może zawierać maksymalnie 20 plików.');
  adding = true;
  try {
    const additions = [];
    for (const input of inputs) {
      const path = String(input.path ?? '').trim();
      if (!validPath(path)) throw new Error('Podaj prawidłową ścieżkę Foundry albo adres HTTP(S).');
      if (state.tracks.some(t => t.path === path) || additions.some(t => t.path === path)) continue;
      const name = String(input.name || path.split('/').pop()).slice(0,100);
      report(`Sprawdzanie: ${name}`);
      const sound = await engine.load({path});
      additions.push({id:foundry.utils.randomID(), name, path, duration:sound.duration});
    }
    // Read current state after potentially slow loads; preserve intervening edits.
    await command({type:'tracks', tracks:[...state.tracks, ...additions]});
    report(`Dodano ścieżek: ${additions.length}`);
  } finally { adding = false; }
}
function refresh() {
  if (!panel || !state) return;
  const gm = controlsAllowed(), stopped = state.status === 'stopped';
  panel.querySelector('[data-authority]').textContent = gm ? 'Wybierz wersję przyciskiem. Podczas pauzy wybór nie uruchamia odtwarzania.' :
    `Sterowanie: ${game.users.activeGM?.name ?? 'brak aktywnego MG'}. Możesz regulować własną głośność.`;
  panel.querySelector('[data-tracks]').innerHTML = state.tracks.length ? state.tracks.map(track =>
    `<div class="sta-track ${track.id === state.selected ? 'selected' : ''}"><button type="button" data-action="select" data-id="${esc(track.id)}" ${gm?'':'disabled'} aria-pressed="${track.id === state.selected}"><span>${esc(track.name)}</span><small>${formatTime(track.duration)} ${track.id === state.selected?'· wybrana':''}</small></button>${gm?`<button class="sta-remove" type="button" data-action="remove" data-id="${esc(track.id)}" title="Usuń z listy (nie usuwa pliku)" ${stopped?'':'disabled'}>✕</button>`:''}</div>`).join('') : '<p>Dodaj pierwszą ścieżkę w sekcji „Pliki i ustawienia”.</p>';
  for (const action of ['play','pause','stop']) panel.querySelector(`[data-action="${action}"]`).disabled = !gm || !state.tracks.length;
  const seek = panel.querySelector('[data-seek]'); seek.max = lengthOf(state) || 1; seek.disabled = !gm || !state.tracks.length;
  panel.querySelector('[data-master]').disabled = !gm;
  panel.querySelector('[data-master]').value = state.volume*100;
  panel.querySelector('[data-local]').value = (engine.localOverride ?? game.settings.get(ID,'localVolume'))*100;
  panel.querySelector('[data-config]').hidden = !game.user.isGM;
  for (const element of panel.querySelectorAll('[data-config] input, [data-config] button, [data-config] select')) element.disabled = !gm;
  for (const element of panel.querySelectorAll('[data-add] input, [data-add] button, .sta-import button, .sta-import select')) element.disabled = !gm || !stopped;
  panel.querySelector('[name="loop"]').checked = state.loop;
  panel.querySelector('[name="loopEnd"]').value = state.loopEnd;
  panel.querySelector('[name="transitionMs"]').value = state.transitionMs;
  const lists = panel.querySelector('[data-playlist]'), previous = lists.value;
  lists.innerHTML = '<option value="">Istniejąca playlista…</option>' + game.playlists.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  lists.value = previous;
  updateClock();
}
function updateClock() {
  if (!panel || panel.hidden || !state) return;
  const t = position(state, clock());
  panel.querySelector('[data-clock]').textContent = `${formatTime(t)} / ${formatTime(lengthOf(state))}`;
  panel.querySelector('[data-status]').textContent = message;
  const slider = panel.querySelector('[data-seek]');
  if (document.activeElement !== slider) slider.value = t;
}
Hooks.once('init', () => {
  game.settings.register(ID, 'transport', {scope:'world', config:false, type:Object, default:initialState(), onChange:receive});
  game.settings.register(ID, 'localVolume', {name:'Wspólny czas: głośność lokalna', scope:'client', config:false, type:Number, default:1,
    onChange:value => { if (engine) { engine.localOverride = clamp(value,0,1); if (state) void engine.accept(state); } }});
  game.keybindings.register(ID, 'open', {name:'Otwórz przełącznik muzyki', editable:[{key:'KeyM', modifiers:['Control','Shift']}],
    onDown:() => { open(); return true; }});
});
Hooks.once('ready', async () => {
  await migrateLegacyData();
  engine = new TimelineEngine({
    create:path => new foundry.audio.Sound(path, {context:game.audio.music, forceBuffer:true}),
    now:clock, unlocked:() => game.audio.unlock,
    gain:() => engine.localOverride ?? game.settings.get(ID,'localVolume'), report
  });
  const saved = game.settings.get(ID, 'transport');
  lastPreload = saved.preload;
  receive(saved);
  game.modules.get(ID).api ??= {};
  game.modules.get(ID).api.audio = {
    open, play:() => command({type:'play'}), pause:() => command({type:'pause'}), stop:() => command({type:'stop'}),
    select:id => command({type:'select',id}), seek:seconds => command({type:'seek',seconds}),
    getState:() => copy(state), resync:() => engine.accept(state)
  };
  launchButton();
  setInterval(updateClock,250);
  setInterval(() => {
    engine.tick();
    if (controlsAllowed() && state.status === 'playing' && !state.loop && position(state,clock()) >= lengthOf(state)) {
      void command({type:'pause'}).catch(notice);
    }
  },2000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void engine.accept(state); });
  game.socket.on('connect', () => {
    void game.time.sync().then(() => engine.accept(game.settings.get(ID,'transport'))).catch(notice);
  });
});
Hooks.on('userConnected', refresh);
