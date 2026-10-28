import {migrateLegacyData} from '../migration.js';
import {ID, initialState, transition, position, lengthOf, validPath, copy} from './core.js';
import {TimelineEngine} from './engine.js';
import {createNativeUI} from './native-ui.js';

let engine, state, queue=Promise.resolve();
const clock=()=>game.time.serverTime;
const allowed=()=>game.user.isGM && game.users.activeGM?.id===game.user.id;
const notice=error=>{console.error(`[${ID}]`,error);ui.notifications.error(error.message??String(error))};
const uiAdapter=createNativeUI({getState:()=>state,now:clock,canControl:allowed,isGM:()=>game.user.isGM,
  playlists:()=>game.playlists.contents??[],toggle:togglePlaylist,command,playTrack,resync,notice});
function serialize(task) {const promise=queue.catch(()=>{}).then(task);queue=promise;return promise;}
function receive(value) {
  if(!engine || (state&&value.revision<=state.revision)) return;
  const changed=JSON.stringify(state?.tracks)!==JSON.stringify(value.tracks);
  state=copy(value);
  // An old unbound set must not play invisibly after the UI upgrade.
  void engine.accept(state.playlistId?state:{...state,status:'stopped'});
  if(changed) engine.prune(state.tracks);
  uiAdapter.refresh();
}
async function write(action) {
  if(!allowed()) throw new Error('Transportem steruje aktualnie główny aktywny MG.');
  const next=transition(game.settings.get(ID,'transport'),action,clock());
  await game.settings.set(ID,'transport',next);receive(next);return next;
}
function command(action){return serialize(()=>write(action));}
async function loadTracks(playlist) {
  const sounds=playlist.sounds.contents??[...playlist.sounds];
  if(!sounds.length) throw new Error('Dodaj utwory do tej playlisty.');
  if(sounds.length>20) throw new Error('Synchro obsługuje do 20 utworów w playliście.');
  const tracks=[];
  for(const sound of sounds) {
    if(!validPath(sound.path)) throw new Error(`Nieprawidłowa ścieżka: ${sound.name}`);
    const loaded=await engine.load({path:sound.path});
    if(!(loaded.duration>0)) throw new Error(`Nie można odczytać długości: ${sound.name}`);
    tracks.push({id:sound.id,name:sound.name,path:sound.path,duration:loaded.duration});
  }
  return tracks;
}
function togglePlaylist(id) {
  return serialize(async()=>{
    if(!allowed()) throw new Error('Tylko główny aktywny MG może zmieniać tryb Synchro.');
    const saved=game.settings.get(ID,'transport');
    if(saved.playlistId===id) return write({type:'unbind'});
    const playlist=game.playlists.get(id);if(!playlist)throw new Error('Nie znaleziono playlisty.');
    // Validate all files before changing the running transport.
    const tracks=await loadTracks(playlist);
    await playlist.stopAll();
    return write({type:'bind',playlistId:id,tracks});
  });
}
function playTrack(id) {
  return serialize(async()=>{
    if(!allowed())throw new Error('Transportem steruje aktualnie główny aktywny MG.');
    const saved=game.settings.get(ID,'transport');
    const playlist=game.playlists.get(saved.playlistId);
    if(!playlist)throw new Error('Włącz Synchro w nagłówku playlisty.');
    // Native updates/macros may have started a sound since binding. Stop only this playlist.
    await playlist.stopAll();
    const selected=id??saved.selected??saved.tracks[0]?.id;
    const sound=playlist.sounds?.get(selected);
    if(sound && Number.isFinite(sound.volume)) await write({type:'volume',value:sound.volume});
    return write({type:'playTrack',id:selected});
  });
}
async function resync(){engine.failed=false;await engine.accept(state.playlistId?state:{...state,status:'stopped'});}
function open(){ui.playlists?.activate();uiAdapter.mount(ui.playlists,ui.playlists?.element);}
Hooks.once('init',()=>{
  game.settings.register(ID,'transport',{scope:'world',config:false,type:Object,default:initialState(),onChange:receive});
  // Retained for backward-compatible saved client settings; native music volume controls remain visible.
  game.settings.register(ID,'localVolume',{scope:'client',config:false,type:Number,default:1});
  game.keybindings.register(ID,'open',{name:'Otwórz muzykę',editable:[{key:'KeyM',modifiers:['Control','Shift']}],onDown:()=>{open();return true}});
});
Hooks.once('ready',async()=>{
  await migrateLegacyData();
  engine=new TimelineEngine({create:path=>new foundry.audio.Sound(path,{context:game.audio.music,forceBuffer:true}),now:clock,
    unlocked:()=>game.audio.unlock,gain:()=>1,report:(text,error)=>{if(error)ui.notifications.warn(`Synchro: ${text}`)}});
  receive(game.settings.get(ID,'transport'));
  game.modules.get(ID).api??={};
  game.modules.get(ID).api.audio={open,togglePlaylist,play:()=>playTrack(state.selected),pause:()=>command({type:'pause'}),stop:()=>command({type:'stop'}),
    select:id=>command({type:'select',id}),seek:seconds=>command({type:'seek',seconds}),getState:()=>copy(state),resync};
  uiAdapter.mount(ui.playlists,ui.playlists?.element);
  setInterval(()=>uiAdapter.tick(),250);
  setInterval(()=>{engine.tick();if(allowed()&&state.playlistId&&state.status==='playing'&&!state.loop&&position(state,clock())>=lengthOf(state))void command({type:'pause'}).catch(notice)},2000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void resync().catch(notice)});
  game.socket.on('connect',()=>{void game.time.sync().then(resync).catch(notice)});
});
Hooks.on('renderPlaylistDirectory',(app,element)=>uiAdapter.mount(app,element));
Hooks.on('closePlaylistDirectory',app=>uiAdapter.close(app));
Hooks.on('userConnected',()=>uiAdapter.refresh());
Hooks.on('deletePlaylist',playlist=>{if(allowed()&&state?.playlistId===playlist.id)void command({type:'unbind'}).catch(notice)});
// Changes to files or membership invalidate preloaded durations. Keep native edits, release Synchro.
function invalidate(sound,changes) {
  if(!allowed()||state?.playlistId!==sound.parent?.id)return;
  if(!changes||'path' in changes||'name' in changes)void command({type:'unbind'}).catch(notice);
  else if(sound.id===state.selected&&'repeat' in changes)void command({type:'options',loop:sound.repeat,loopEnd:state.loopEnd,transitionMs:state.transitionMs}).catch(notice);
  else if(sound.id===state.selected&&'volume' in changes)void command({type:'volume',value:sound.volume}).catch(notice);
}
Hooks.on('createPlaylistSound',sound=>invalidate(sound));
Hooks.on('deletePlaylistSound',sound=>invalidate(sound));
Hooks.on('updatePlaylistSound',(sound,changes)=>invalidate(sound,changes));
