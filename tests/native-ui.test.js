import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createNativeUI} from '../scripts/audio/native-ui.js';
import {initialState,transition,position} from '../scripts/audio/core.js';

function fixture(gm=true) {
  const {document,window}=parseHTML(`<html><body><section id="playlists"><section data-application-part="playing"></section><ol class="directory-list"><li class="playlist directory-item" data-entry-id="p1"><header class="playlist-header"><h4>Test</h4><div class="playlist-controls"><a data-action="soundCreate">+</a><a data-action="playlistMode">mode</a><a data-action="playlistPlay">play</a></div></header><ol class="playlist-sounds"><li class="sound flexrow" data-sound-id="a"><i class="fa-music"></i><span class="sound-name">A</span><div class="sound-controls"><a data-action="soundRepeat">repeat</a><a data-action="soundPlay">play</a></div></li><li class="sound flexrow" data-sound-id="b"><i class="fa-music"></i><span class="sound-name">B</span><div class="sound-controls"><a data-action="soundRepeat">repeat</a><a data-action="soundPlay">play</a></div></li></ol></li><li class="playlist directory-item" data-entry-id="other"><header class="playlist-header"><div class="playlist-controls"><a data-action="playlistPlay">play</a></div></header></li></ol></section></body></html>`);
  const root=document.querySelector('#playlists');
  let state={...initialState(),playlistId:'p1',status:'playing',selected:'a',anchor:0,tracks:[{id:'a',name:'A',duration:1200},{id:'b',name:'B',duration:1200}]},now=792000;
  const calls=[],errors=[];
  const ui=createNativeUI({getState:()=>state,now:()=>now,canControl:()=>gm,isGM:()=>gm,playlists:()=>[{id:'p1'},{id:'other'}],
    toggle:async id=>calls.push(['toggle',id]),command:async a=>{calls.push(a);state=transition(state,a,now);ui.refresh()},
    playTrack:async id=>{calls.push(['play',id]);state=transition(state,{type:'playTrack',id},now);ui.refresh()},resync:async()=>calls.push('resync'),notice:e=>errors.push(e)});
  ui.mount({},root);
  const click=node=>node.dispatchEvent(new window.Event('click',{bubbles:true,cancelable:true}));
  return {root,ui,calls,errors,click,window,get state(){return state}};
}
test('native playlist markup remains intact; one chain per header; no old panel or cards',()=>{
  const f=fixture();f.ui.refresh();f.ui.mount({},f.root);
  assert.equal(f.root.querySelectorAll('.sta-sync-toggle').length,2);
  const list=f.root.querySelector('.directory-list');
  assert.equal(list.querySelectorAll('.sound').length,2);
  assert.equal(list.querySelectorAll('[data-action="soundPlay"]').length,2);
  assert.equal(list.querySelectorAll('[data-action="soundRepeat"]').length,2);
  assert.equal(list.querySelectorAll('[data-action="playlistMode"]').length,1);
  assert.equal(f.root.querySelectorAll('.sta-current').length,1);
  assert.equal(f.root.querySelectorAll('.sta-sidebar, .sta-track, [data-add], [data-local], [data-master]').length,0);
});
test('player sees only current song/time and resync; no chain, seek or transport',async()=>{
  const f=fixture(false),current=f.root.querySelector('.sta-current');
  assert.equal(current.querySelector('.sound-name').textContent,'A');
  assert.equal(current.querySelector('[data-clock]').textContent,'13:12 / 20:00');
  assert.equal(current.querySelectorAll('button').length,1);
  assert.equal(current.querySelectorAll('[data-seek], [data-jump], [data-action]').length,0);
  assert.equal(f.root.querySelectorAll('.sta-sync-toggle').length,0);
  f.click(current.querySelector('.sta-resync'));await new Promise(r=>setImmediate(r));assert.deepEqual(f.calls,['resync']);
});
test('native play routes to shared time; unrelated playlist controls pass through',async()=>{
  const f=fixture();
  const button=f.root.querySelector('.directory-list [data-sound-id="b"] [data-action="soundPlay"]');
  f.click(button);await new Promise(r=>setImmediate(r));
  assert.deepEqual(f.calls[0],['play','b']);assert.equal(f.state.selected,'b');assert.equal(position(f.state,792000),792);
  const before=f.calls.length;f.click(f.root.querySelector('[data-entry-id="other"] [data-action="playlistPlay"]'));
  await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,before);
});
test('bind/unbind and native play preserve the intended transport state',()=>{
  let s=transition(initialState(),{type:'bind',playlistId:'p',tracks:[{id:'a',duration:1200},{id:'b',duration:1200}]},0);
  assert.equal(s.status,'stopped');s=transition(s,{type:'playTrack',id:'a'},0);
  s=transition(s,{type:'playTrack',id:'b'},792000);assert.equal(s.offset,792);
  s=transition(s,{type:'pause'},802000);s=transition(s,{type:'playTrack',id:'a'},902000);
  assert.equal(s.offset,802);assert.equal(s.status,'playing');
  s=transition(s,{type:'unbind'},902000);assert.equal(s.playlistId,null);assert.equal(s.status,'stopped');
});
