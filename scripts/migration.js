const ID = 'wfrp4e-fan-tools';
const OLD_CHASE = 'wfrp4e-pod-bronia-poscigi';
const OLD_AUDIO = 'shared-timeline-audio';
let pending;

// Read saved values without registering settings for a module that is no longer installed.
function saved(storage, key) {
  const raw = storage?.getItem(key);
  return raw == null ? undefined : JSON.parse(raw);
}
export async function migrate(game) {
  const local = game.settings.storage?.get('client');
  if (local && local.getItem(`${ID}.localVolume`) == null) {
    const volume = saved(local, `${OLD_AUDIO}.localVolume`);
    if (typeof volume === 'number') await game.settings.set(ID, 'localVolume', volume);
  }
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  const world = game.settings.storage?.get('world');
  if (!world) return;
  for (const [source, key] of [[OLD_CHASE, 'tracker'], [OLD_AUDIO, 'transport']]) {
    if (world.getItem(`${ID}.${key}`) != null) continue;
    const value = saved(world, `${source}.${key}`);
    if (value === undefined) continue;
    // Never resume a historical clock unexpectedly after installing the new module.
    if (key === 'transport') { value.status = 'paused'; value.anchor = 0; }
    await game.settings.set(ID, key, value);
  }
  const oldImage = `modules/${OLD_CHASE}/assets/chase-board.svg`;
  for (const scene of game.scenes ?? []) {
    if (scene.background?.src === oldImage) {
      await scene.update({'background.src': `modules/${ID}/assets/chase-board.svg`});
    }
  }
}
export function migrateLegacyData() {
  return pending ??= migrate(game).catch(error => {
    pending = undefined;
    console.error(`${ID} | Migration failed`, error);
    ui.notifications.error('Nie udało się przenieść danych Narzędzi WFRP4e. Sprawdź konsolę i przeładuj świat.');
    throw error;
  });
}
