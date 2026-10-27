import test from 'node:test';
import assert from 'node:assert/strict';
import {migrate} from '../scripts/migration.js';

function fixture(isGM=true) {
  const old='wfrp4e-pod-bronia-poscigi', id='wfrp4e-fan-tools';
  const world=new Map([[`${old}.tracker`, JSON.stringify({participants:[{actorId:'a'}]})],
    ['shared-timeline-audio.transport',JSON.stringify({tracks:[{id:'song'}],status:'playing',anchor:123,offset:42})]]);
  const local=new Map([['shared-timeline-audio.localVolume','0.4']]);
  world.getItem=k=>world.get(k)??null;local.getItem=k=>local.get(k)??null;
  const changes=[];
  const scene={background:{src:`modules/${old}/assets/chase-board.svg`},async update(v){changes.push(v);this.background.src=v['background.src']}};
  const game={user:{id:isGM?'gm':'p',isGM},users:{activeGM:{id:'gm'}},scenes:[scene],
    settings:{storage:new Map([['world',world],['client',local]]),async set(ns,key,value){(key==='localVolume'?local:world).set(`${ns}.${key}`,JSON.stringify(value))}}};
  return {game,world,local,changes,id};
}
test('migration preserves legacy data, pauses audio, repairs board path, and never overwrites new state', async()=>{
  const {game,world,local,changes,id}=fixture();
  await migrate(game);
  assert.equal(JSON.parse(world.get(`${id}.tracker`)).participants[0].actorId,'a');
  assert.equal(JSON.parse(world.get(`${id}.transport`)).status,'paused');
  assert.equal(JSON.parse(world.get(`${id}.transport`)).offset,42);
  assert.equal(local.get(`${id}.localVolume`),'0.4');
  assert.equal(changes.length,1);
  world.set(`${id}.tracker`,JSON.stringify({participants:[]}));
  await migrate(game);
  assert.deepEqual(JSON.parse(world.get(`${id}.tracker`)),{participants:[]});
  assert.ok(world.has('wfrp4e-pod-bronia-poscigi.tracker'));
  assert.equal(changes.length,1);
});
test('player migrates only personal volume; world writes belong to active GM',async()=>{
  const {game,world,local,changes,id}=fixture(false);await migrate(game);
  assert.equal(world.has(`${id}.tracker`),false);assert.equal(changes.length,0);
  assert.equal(local.get(`${id}.localVolume`),'0.4');
});
