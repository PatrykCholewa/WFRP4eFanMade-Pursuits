import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {initialState} from '../scripts/audio/core.js';

test('GM/player/late join world setting propagation and access control (mock Foundry)',async()=>{
  let now=1000;
  let world={...initialState(),tracks:[{id:'a',name:'A',path:'a.ogg',duration:300},{id:'b',name:'B',path:'b.ogg',duration:300}],selected:'a'};
  const clients=[];
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  async function client(isGM) {
    const hooks=new Map(), config=new Map(), local=new Map(), elements=new Map(), sounds=[];
    const gm={id:'gm',isGM:true,name:'MG'};
    const game={user:isGM?gm:{id:'p',isGM:false},users:{activeGM:gm},modules:new Map([['wfrp4e-fan-tools',{}]]),
      keybindings:{register(){}},playlists:{map:()=>[]},socket:{on(){}},
      time:{get serverTime(){return now},sync:async()=>{}},audio:{unlock:Promise.resolve(),music:{}},
      settings:{register(id,key,c){config.set(key,c);local.set(key,c.default)},get(id,key){return structuredClone(key==='transport'?world:local.get(key))},
        async set(id,key,value){
          if(key==='transport'){
            if(!isGM)throw new Error('server denies player');
            world=structuredClone(value);
            for(const c of clients)c.config.get(key).onChange(structuredClone(value));
          }else{local.set(key,value);config.get(key).onChange?.(value)}
          return value;
        }}
    };
    class Sound {
      constructor(path){this.path=path;this.duration=300;this.playing=false;this.calls=[];sounds.push(this)}
      async load(){return this}
      get currentTime(){return this.playing?(this.offset+(now-this.start)/1000)%300:0}
      async play(options){assert.equal(sounds.filter(s=>s.playing&&s!==this).length,0);this.offset=options.offset;this.start=now;this.playing=true;this.calls.push(options)}
      async stop(){this.playing=false}
      async fade(){}
    }
    const context=vm.createContext({console,game,Promise,Map,Set,JSON,Date,setTimeout,clearTimeout,setInterval(){},
      document:{createElement:()=>({setAttribute(){},addEventListener(){}}),getElementById:id=>elements.get(id),body:{append:e=>elements.set(e.id,e)},addEventListener(){}},
      Hooks:{once:(name,fn)=>hooks.set(name,[...(hooks.get(name) ?? []),fn]),on(){}},
      foundry:{appv1:{api:{Application:class {}}},audio:{Sound},utils:{randomID:()=>Math.random().toString(36)},applications:{apps:{}}},
      ui:{notifications:{error:err=>{throw new Error(err)},warn(){}}}});
    const modules=new Map();
    async function load(name){
      if(modules.has(name))return modules.get(name);
      const source=await readFile(new URL(`../scripts/${name}`,import.meta.url),'utf8');
      const m=new vm.SourceTextModule(source,{context,identifier:name});modules.set(name,m);
      await m.link(spec=>load(new URL(spec, 'file:///scripts/'+name).pathname.replace('/scripts/','')));return m;
    }
    const main=await load('main.js');await main.evaluate();for(const fn of hooks.get('init')) await fn();
    const item={config,game,sounds};clients.push(item);for(const fn of hooks.get('ready')) await fn();await settle();
    assert.equal(game.modules.get('wfrp4e-fan-tools').api.chase,game.wfrpChase);
    assert.equal(typeof game.wfrpChase.openTracker,'function');
    item.api=game.modules.get('wfrp4e-fan-tools').api.audio;return item;
  }
  const gm=await client(true), player=await client(false);
  await gm.api.play();await settle();
  now=96000;await gm.api.select('b');await settle();
  for(const c of clients){const b=c.sounds.find(s=>s.path==='b.ogg');assert.ok(b.playing);assert.equal(b.calls.at(-1).offset,95)}
  now=116000;await gm.api.select('a');await settle();
  for(const c of clients)assert.equal(c.sounds.find(s=>s.path==='a.ogg').calls.at(-1).offset,115);
  await gm.api.pause();await settle();now=126000;
  await gm.api.select('b');await settle();assert.equal(world.offset,115);assert.equal(world.status,'paused');
  for(const c of clients)assert.equal(c.sounds.some(s=>s.playing),false);
  await gm.api.play();await settle();now=131000;
  const late=await client(false);assert.equal(late.sounds.find(s=>s.path==='b.ogg').calls.at(-1).offset,120);
  await assert.rejects(player.api.stop(),/główny aktywny MG/);
  assert.equal(world.status,'playing');
  await gm.api.stop();await settle();
  for(const c of clients)assert.equal(c.sounds.some(s=>s.playing),false);
  assert.equal(world.offset,0);
});
