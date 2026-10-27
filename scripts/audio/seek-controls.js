import {formatTime} from './core.js';

export function parseTimestamp(text) {
  const value = String(text).trim();
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (!/^\d+:\d{1,2}(?::\d{1,2})?$/.test(value)) throw new Error('Wpisz czas jako mm:ss, hh:mm:ss lub liczbę sekund.');
  const parts = value.split(':').map(Number);
  if (parts.slice(1).some(n => n >= 60)) throw new Error('Sekundy i minuty po dwukropku muszą być mniejsze od 60.');
  return parts.reduce((total, n) => total * 60 + n, 0);
}
export function bindSeekControls(panel, {position, length, seek, notice}) {
  const slider = panel.querySelector('[data-seek]');
  const commit = seconds => {
    const target = Math.max(0, Math.min(length(), seconds));
    Promise.resolve().then(() => seek(target)).catch(notice);
  };
  slider.addEventListener('pointerdown', () => { panel.dataset.seeking = 'true'; });
  slider.addEventListener('input', () => {
    panel.dataset.seeking = 'true';
    panel.querySelector('[data-clock]').textContent = `${formatTime(Number(slider.value))} / ${formatTime(length())}`;
  });
  slider.addEventListener('change', () => { delete panel.dataset.seeking; commit(Number(slider.value)); });
  for (const event of ['pointercancel', 'blur', 'pointerup']) slider.addEventListener(event, () => { delete panel.dataset.seeking; });
  panel.querySelector('[data-jump]').addEventListener('submit', event => {
    event.preventDefault();
    try { commit(parseTimestamp(panel.querySelector('[data-timestamp]').value)); } catch (error) { notice(error); }
  });
  for (const [action, delta] of [['back', -10], ['forward', 10]]) {
    panel.querySelector(`[data-action="${action}"]`).addEventListener('click', () => commit(position() + delta));
  }
}
