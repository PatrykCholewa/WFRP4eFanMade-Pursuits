import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTimestamp, bindSeekControls} from '../scripts/audio/seek-controls.js';

class Field extends EventTarget { value=''; textContent=''; }
test('timestamps accept 13:12 and hours, reject malformed or negative input',()=>{
  assert.equal(parseTimestamp('13:12'),792);
  assert.equal(parseTimestamp('1:13:12'),4392);
  assert.equal(parseTimestamp(' 792.5 '),792.5);
  for (const text of ['', '-1', '1:60', '1:99:00', 'abc']) assert.throws(()=>parseTimestamp(text));
});
test('slider previews until release, timestamp and ±10 seek on the same timeline',async()=>{
  const fields=new Map();
  const panel={dataset:{},querySelector(selector){if(!fields.has(selector)) fields.set(selector,new Field());return fields.get(selector)}};
  const calls=[],errors=[];let now=792;
  bindSeekControls(panel,{position:()=>now,length:()=>900,seek:async s=>{calls.push(s);now=s},notice:e=>errors.push(e)});
  const field=s=>panel.querySelector(s),event=(s,e)=>field(s).dispatchEvent(new Event(e,{cancelable:true}));
  const settle=()=>new Promise(r=>setImmediate(r));
  field('[data-seek]').value='300';event('[data-seek]','pointerdown');event('[data-seek]','input');
  assert.equal(panel.dataset.seeking,'true');assert.deepEqual(calls,[]);
  assert.equal(field('[data-clock]').textContent,'5:00 / 15:00');
  event('[data-seek]','change');await settle();assert.deepEqual(calls,[300]);assert.equal(panel.dataset.seeking,undefined);
  field('[data-timestamp]').value='13:12';event('[data-jump]','submit');await settle();assert.equal(now,792);
  event('[data-action="forward"]','click');await settle();assert.equal(now,802);
  event('[data-action="back"]','click');await settle();assert.equal(now,792);
  field('[data-timestamp]').value='20:00';event('[data-jump]','submit');await settle();assert.equal(now,900);
  field('[data-timestamp]').value='invalid';event('[data-jump]','submit');assert.equal(errors.length,1);
});
