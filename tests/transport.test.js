import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState, position, transition, lengthOf, drift, validPath} from '../scripts/audio/core.js';
import {TimelineEngine} from '../scripts/audio/engine.js';
const tracks = [{id:'a',name:'A',path:'a.ogg',duration:300},{id:'b',name:'B',path:'b.ogg',duration:320}];
const seed = () => ({...initialState(),tracks,selected:'a'});

test('A 1:35 → B 1:35 → A 1:55; selection never resets the shared clock', () => {
  let s=transition(seed(),{type:'play'},1000);
  s=transition(s,{type:'select',id:'b'},96000);
  assert.equal(position(s,96000),95);
  s=transition(s,{type:'select',id:'a'},116000);
  assert.equal(position(s,116000),115);
});
test('pause freezes time including while changing tracks; resume continues', () => {
  let s=transition(seed(),{type:'play'},1000);
  s=transition(s,{type:'pause'},11000);
  s=transition(s,{type:'select',id:'b'},999000);
  assert.equal(position(s,1000000),10);
  assert.equal(s.status,'paused');
  s=transition(s,{type:'play'},1000000);
  assert.equal(position(s,1002000),12);
});
test('seek and stop affect every track through the same state', () => {
  let s=transition(seed(),{type:'play'},1000);
  s=transition(s,{type:'seek',seconds:80},5000);
  assert.equal(position(s,8000),83);
  s=transition(s,{type:'stop'},8000);
  assert.equal(position(s,9000),0);
});
test('late joins use elapsed server time and common shortest loop', () => {
  const s=transition(seed(),{type:'play'},1000);
  assert.equal(lengthOf(s),300);
  assert.equal(position(s,306000),5);
  assert.ok(drift(299.9,0.1,300,true)<0.21);
});
test('custom loop and nonloop end are explicit', () => {
  let s=transition(seed(),{type:'options',loop:true,loopEnd:120,transitionMs:120},0);
  s=transition(s,{type:'play'},1000);
  assert.equal(position(s,125000),4);
  s=transition(s,{type:'options',loop:false,loopEnd:120,transitionMs:120},125000);
  assert.equal(position(s,300000),120);
});
test('bad track changes fail without modifying caller state', () => {
  const s=transition(seed(),{type:'play'},1000);
  assert.throws(()=>transition(s,{type:'select',id:'missing'},2000));
  assert.throws(()=>transition(s,{type:'tracks',tracks:[]},2000));
  assert.equal(s.selected,'a');
});
test('reject executable and local-browser URLs', () => {
  for (const p of ['javascript:alert(1)','data:audio/wav;base64,AAA','file:///secret','blob:abc','']) assert.equal(validPath(p),false);
  assert.equal(validPath('worlds/test/a.ogg'),true);
  assert.equal(validPath('https://cdn.example/a.mp3'),true);
});

function setup(deferred = {}) {
  let now=1000; const events=[], sounds=new Map();
  const engine=new TimelineEngine({now:()=>now,unlocked:()=>Promise.resolve(),gain:()=>1,
    create:path=>{
      const sound={duration:300,playing:false,currentTime:0,
        async load(){if(deferred[path])await deferred[path];return this;},
        async play(options){assert.equal([...sounds.values()].filter(s=>s.playing).length,0,'two versions must not overlap');this.playing=true;this.currentTime=options.offset;events.push(['play',path,options]);},
        async stop(){this.playing=false;events.push(['stop',path]);},
        async fade(volume){events.push(['volume',path,volume]);}
      };sounds.set(path,sound);return sound;
    }});
  return {engine,events,sounds,setNow:n=>{now=n;}};
}
test('engine switches at current timestamp and stops A before B starts', async () => {
  const {engine,events,setNow}=setup();
  let s=transition(seed(),{type:'play'},1000);await engine.accept(s);
  setNow(96000);s=transition(s,{type:'select',id:'b'},96000);await engine.accept(s);
  assert.deepEqual(events.map(e=>e.slice(0,2)),[['play','a.ogg'],['stop','a.ogg'],['play','b.ogg']]);
  assert.equal(events.at(-1)[2].offset,95);
  assert.equal(events.at(-1)[2].loopEnd,300);
});
test('stale delayed load cannot override a later track selection', async () => {
  let release;const held=new Promise(resolve=>{release=resolve;});
  const {engine,events,setNow}=setup({'b.ogg':held});
  let s=transition(seed(),{type:'play'},1000);await engine.accept(s);
  setNow(3000);s=transition(s,{type:'select',id:'b'},3000);const pending=engine.accept(s);
  await Promise.resolve();
  s=transition(s,{type:'select',id:'a'},3000);await engine.accept(s);
  release();await pending;
  assert.equal(engine.current.id,'a');
  assert.equal(events.some(e=>e[0]==='play'&&e[1]==='b.ogg'),false);
});
test('stop during load cancels pending playback', async () => {
  let release;const held=new Promise(resolve=>{release=resolve;});
  const {engine}=setup({'a.ogg':held});
  let s=transition(seed(),{type:'play'},1000);const pending=engine.accept(s);
  await Promise.resolve();s=transition(s,{type:'stop'},2000);await engine.accept(s);
  release();await pending;assert.equal(engine.current,null);
});
test('delayed browser unlock starts at current time, not original offset', async () => {
  let release;const held=new Promise(resolve=>{release=resolve;});
  const {engine,events,setNow}=setup();engine.unlocked=()=>held;
  const pending=engine.accept(transition(seed(),{type:'play'},1000));
  setNow(6000);release();await pending;
  assert.equal(events[0][2].offset,5);
});
test('failed load stops previous audio and is not retried every tick', async () => {
  const {engine}=setup();let calls=0;
  await engine.accept(transition(seed(),{type:'play'},1000));
  const original=engine.load.bind(engine);
  engine.load=async track=>{calls++;if(track.id==='b')throw new Error('404');return original(track);};
  await engine.accept(transition(engine.state,{type:'select',id:'b'},2000));
  assert.equal(engine.current,null);engine.tick();engine.tick();
  assert.equal(calls,1);
});
