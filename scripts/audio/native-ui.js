import {bindSeekControls} from './seek-controls.js';
import {formatTime, position, lengthOf} from './core.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const actionName = node => String(node?.dataset.action ?? '').replace(/[-_]/g,'').toLowerCase();
export function playlistElement(root, id) {
  return [...root.querySelectorAll('[data-playlist-id], [data-document-id], [data-entry-id]')].find(e =>
    !e.closest('.sta-current') && !e.hasAttribute('data-sound-id') &&
    [e.dataset.playlistId,e.dataset.documentId,e.dataset.entryId].includes(id) &&
    (e.classList.contains('playlist') || e.classList.contains('directory-item')));
}
export function createNativeUI({getState, now, canControl, isGM, playlists, toggle, command, playTrack, resync, notice}) {
  const roots = new Map();
  function mount(app, root) {
    if (!root?.querySelector) return;
    const previous = roots.get(root);
    if (!previous) {
      roots.set(root,{app});
      root.addEventListener('click', event => {
        const target=event.target.closest('[data-action]');
        if (!target) return;
        const action=actionName(target), s=getState();
        if (action==='stasynchro') {
          event.preventDefault();event.stopImmediatePropagation();
          if (canControl()) void toggle(target.dataset.playlistId).catch(notice);
          return;
        }
        if (!s?.playlistId) return;
        const current=target.closest('.sta-current');
        const list=playlistElement(root,s.playlistId);
        if (!current && !list?.contains(target)) return;
        const names=['soundplay','soundpause','soundstop','playlistplay','playliststop','playlistnext','playlistprevious','playlistforward','playlistbackward'];
        if (!names.includes(action)) return;
        event.preventDefault();event.stopImmediatePropagation();
        if (!canControl()) return;
        const row=target.closest('[data-sound-id]');
        const id=row?.dataset.soundId ?? s.selected;
        let task;
        if (action==='soundpause') task=command({type:s.status==='playing'?'pause':'play'});
        else if (action.endsWith('stop')) task=command({type:'stop'});
        else if (['playlistnext','playlistprevious','playlistforward','playlistbackward'].includes(action)) {
          const delta=['playlistprevious','playlistbackward'].includes(action)?-1:1;
          const index=s.tracks.findIndex(t=>t.id===s.selected);
          task=playTrack(s.tracks[(index+delta+s.tracks.length)%s.tracks.length]?.id);
        } else task=playTrack(id ?? s.tracks[0]?.id);
        void task.catch(notice);
      },true);
    }
    refreshRoot(root);
  }
  function refreshRoot(root) {
    const s=getState();
    if (!s) return;
    // Never rebuild or restyle the native playlist list and its existing controls.
    for (const button of root.querySelectorAll('[data-action="staSynchro"]')) button.remove();
    if (isGM()) for (const playlist of playlists()) {
      const item=playlistElement(root,playlist.id);
      if (!item) continue;
      const header=item.querySelector('.playlist-header, .directory-item-header, header') ?? item;
      const controls=header.querySelector('.playlist-controls, .entry-controls, .document-controls');
      const button=root.ownerDocument.createElement('a');
      button.className='playlist-control sta-sync-toggle';button.dataset.action='staSynchro';button.dataset.playlistId=playlist.id;
      button.setAttribute('role','button');button.tabIndex=0;
      const enabled=s.playlistId===playlist.id;
      button.setAttribute('aria-pressed',String(enabled));
      button.setAttribute('aria-disabled',String(!canControl()));
      button.title=enabled?'Wyłącz Synchro':'Włącz Synchro — przełączanie ze wspólnym czasem';
      button.setAttribute('aria-label',button.title);
      button.innerHTML='<i class="fas fa-link" aria-hidden="true"></i>';
      button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();button.click()}});
      if(controls) controls.prepend(button);else header.append(button);
    }
    const selected=s.tracks.find(t=>t.id===s.selected);
    let current=root.querySelector('.sta-current');
    if (!selected || !s.playlistId || s.status==='stopped') {current?.remove();return;}
    const signature=JSON.stringify([s.playlistId,s.selected,s.status,canControl(),selected.name]);
    if (current?.dataset.signature!==signature) {
      current?.remove();
      current=root.ownerDocument.createElement('section');current.className='sta-current';current.dataset.signature=signature;
      const nativeList=playlistElement(root,s.playlistId);
      const source=[...nativeList?.querySelectorAll('[data-sound-id]') ?? []].find(e=>e.dataset.soundId===s.selected);
      const row=source?.cloneNode(true) ?? root.ownerDocument.createElement('li');
      row.classList.add('sound','flexrow');row.dataset.soundId=s.selected;row.dataset.playlistId=s.playlistId;
      // Keep native row/name markup and theme classes. Replace only transport controls for this current-playing copy.
      for(const el of row.querySelectorAll('[id]')) el.removeAttribute('id');row.removeAttribute('id');
      for(const name of row.querySelectorAll('.sound-name')) name.removeAttribute('data-action');
      for(const el of row.querySelectorAll('.sound-controls, .sound-volume, .sound-timer, [data-action], input, range-picker')) {
        if(!el.classList.contains('sound-name')) el.remove();
      }
      if (!row.querySelector('.sound-name')) row.innerHTML=`<i class="fas fa-music" aria-hidden="true"></i><span class="sound-name">${esc(selected.name)}</span>`;
      const actions=root.ownerDocument.createElement('div');actions.className='sound-controls flexrow';
      if(canControl()) actions.innerHTML=`<a class="sound-control" data-action="soundPause" role="button" tabindex="0" title="${s.status==='playing'?'Pauza':'Wznów'}"><i class="fas fa-${s.status==='playing'?'pause':'play'}"></i></a><a class="sound-control" data-action="soundStop" role="button" tabindex="0" title="Stop"><i class="fas fa-stop"></i></a>`;
      actions.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){const target=event.target.closest('[role=button]');if(target){event.preventDefault();target.click()}}});
      row.append(actions);
      current.innerHTML='<h4>Obecnie odtwarzane</h4><ol class="playlist-sounds"></ol><div class="sound-timer" data-clock></div>';
      current.querySelector('ol').append(row);
      if(canControl()) {
        current.insertAdjacentHTML('beforeend','<input data-seek type="range" min="0" step="0.1" aria-label="Pozycja odtwarzania"><form data-jump class="sta-jump"><button type="button" data-action="back">−10 s</button><input data-timestamp type="text" placeholder="mm:ss" aria-label="Czas mm:ss"><button type="submit">Przejdź</button><button type="button" data-action="forward">+10 s</button></form>');
        bindSeekControls(current,{position:()=>position(getState(),now()),length:()=>lengthOf(getState()),seek:seconds=>command({type:'seek',seconds}),notice});
      }
      const sync=root.ownerDocument.createElement('button');sync.type='button';sync.className='sta-resync';sync.innerHTML='<i class="fas fa-rotate" aria-hidden="true"></i> Synchronizuj u mnie';
      sync.addEventListener('click',e=>{e.stopPropagation();void resync().catch(notice)});current.append(sync);
      current.addEventListener('submit',e=>e.stopPropagation());current.addEventListener('keydown',e=>e.stopPropagation());
      const playing=root.querySelector('[data-application-part="playing"]');
      if(playing) playing.after(current);
      else {const list=root.querySelector('.directory-list');if(list)list.before(current);else root.append(current)}
    }
    updateClock(root);
  }
  function updateClock(root) {
    const s=getState(), current=root.querySelector('.sta-current');if(!s||!current)return;
    const slider=current.querySelector('[data-seek]');
    const time=current.dataset.seeking&&slider?Number(slider.value):position(s,now());
    current.querySelector('[data-clock]').textContent=`${formatTime(time)} / ${formatTime(lengthOf(s))}`;
    if(slider){slider.max=lengthOf(s);if(!current.dataset.seeking&&root.ownerDocument.activeElement!==slider)slider.value=time;}
  }
  return {mount, refresh(){for(const root of roots.keys())refreshRoot(root)},tick(){for(const root of roots.keys())if(root.isConnected)updateClock(root)},close(app){for(const [root,entry]of roots)if(entry.app===app)roots.delete(root)}};
}
