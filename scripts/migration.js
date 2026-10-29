const ID = 'wfrp4e-fan-tools';
const OLD_CHASE = 'wfrp4e-pod-bronia-poscigi';
const OLD_AUDIO = 'shared-timeline-audio';
let pending;

// Read saved values without registering settings for a module that is no longer installed.
function saved(storage, key) {
  const raw = storage?.getItem(key);
  if (raw == null) return undefined;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
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
    const savedValue = saved(world, `${source}.${key}`);
    if (savedValue === undefined) continue;
    let value = savedValue;
    // Never resume a historical clock unexpectedly after installing the new module.
    if (key === 'transport') value = {...value, status: 'paused', anchor: 0};
    await game.settings.set(ID, key, value);
  }
  const oldImage = `modules/${OLD_CHASE}/assets/chase-board.svg`;
  const newImage = `modules/${ID}/assets/chase-board.svg`;
  for (const scene of game.scenes ?? []) {
    for (const level of scene.levels ?? []) {
      if (level.background?.src === oldImage) {
        await level.update({'background.src': newImage});
      }
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
