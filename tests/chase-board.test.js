import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function loadChaseApi() {
  const hooks = new Map();
  const scenes = [];
  const game = {
    settings: {register() {}},
    modules: new Map([['wfrp4e-fan-tools', {api: {}}]]),
    scenes: {
      getName(name) {
        return scenes.find(scene => scene.name === name);
      }
    }
  };
  class Application {}
  const context = vm.createContext({
    game,
    Hooks: {
      once(name, fn) { hooks.set(name, [...(hooks.get(name) ?? []), fn]); },
      on() {}
    },
    Scene: {
      async create(data) {
        const level = {
          background: {...data.levels[0].background},
          async update(changes) { this.background.src = changes['background.src']; }
        };
        const scene = {
          ...data,
          firstLevel: level,
          async view() { this.viewed = true; }
        };
        scenes.push(scene);
        return scene;
      }
    },
    foundry: {
      appv1: {api: {Application}},
      utils: {
        mergeObject: (target, source) => ({...target, ...source}),
        escapeHTML: value => String(value)
      }
    },
    ui: {},
    console
  });
  const source = await readFile(new URL('../scripts/main.js', import.meta.url), 'utf8');
  const main = new vm.SourceTextModule(source, {context});
  await main.link(async specifier => {
    const exports = specifier === './roll-requests.js'
      ? 'export function initializeRollRequestSupport() { return {openRollRequestDialog() {}}; }'
      : 'export function migrateLegacyData() {}';
    return new vm.SourceTextModule(exports, {context});
  });
  await main.evaluate();
  for (const init of hooks.get('init') ?? []) await init();
  return {chase: game.wfrpChase, scenes};
}

test('new chase board uses a V14 Level background', async () => {
  const {chase, scenes} = await loadChaseApi();
  const scene = await chase.ensureBoardScene();

  assert.equal(scene.levels[0].background.src, 'modules/wfrp4e-fan-tools/assets/chase-board.svg');
  assert.equal(Object.hasOwn(scene, 'background'), false);
  assert.equal(scenes.length, 1);
  await chase.openBoard();
  assert.equal(scene.viewed, true);
});

test('existing chase scene without a background is repaired on open', async () => {
  const {chase, scenes} = await loadChaseApi();
  const level = {
    background: {},
    async update(changes) { this.background.src = changes['background.src']; }
  };
  const scene = {name: 'Plansza poscigu', firstLevel: level};
  scenes.push(scene);

  assert.equal(await chase.ensureBoardScene(), scene);
  assert.equal(level.background.src, 'modules/wfrp4e-fan-tools/assets/chase-board.svg');
  assert.equal(scenes.length, 1);
});
