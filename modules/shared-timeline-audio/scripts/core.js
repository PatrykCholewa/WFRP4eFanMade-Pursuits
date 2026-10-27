export const ID = 'shared-timeline-audio';
export const clamp = (n, a, b) => Math.min(b, Math.max(a, Number(n) || 0));
export const copy = value => JSON.parse(JSON.stringify(value));
export function initialState() {
  return {schema: 1, revision: 0, tracks: [], selected: null, status: 'stopped',
    offset: 0, anchor: 0, loop: true, loopEnd: 0, volume: 0.7, transitionMs: 120, preload: 0};
}
export function lengthOf(state) {
  const lengths = state.tracks.map(t => t.duration).filter(d => Number.isFinite(d) && d > 0);
  const shortest = lengths.length ? Math.min(...lengths) : 0;
  return state.loopEnd > 0 ? Math.min(shortest, state.loopEnd) : shortest;
}
export function position(state, now) {
  const duration = lengthOf(state);
  if (!duration) return 0;
  let t = Math.max(0, state.offset + (state.status === 'playing' ? Math.max(0, now - state.anchor) / 1000 : 0));
  if (state.loop && state.status === 'playing') return t % duration;
  return Math.min(t, duration);
}
export function drift(a, b, duration, loop) {
  const d = Math.abs(a - b);
  return loop && duration > 0 ? Math.min(d, Math.abs(duration - d)) : d;
}
export function transition(state, action, now) {
  const s = copy(state);
  s.offset = position(state, now);
  s.anchor = now;
  const duration = lengthOf(s);
  switch (action.type) {
    case 'select':
      if (!s.tracks.some(t => t.id === action.id)) throw new Error('Nie znaleziono ścieżki.');
      s.selected = action.id;
      break;
    case 'play':
      if (!s.tracks.length) throw new Error('Najpierw dodaj plik audio.');
      s.selected ||= s.tracks[0].id;
      if (s.offset >= duration) s.offset = 0;
      s.status = 'playing';
      break;
    case 'pause': s.status = 'paused'; break;
    case 'stop': s.status = 'stopped'; s.offset = 0; break;
    case 'seek': s.offset = clamp(action.seconds, 0, Math.max(0, duration - 0.001)); break;
    case 'volume': s.volume = clamp(action.value, 0, 1); break;
    case 'options':
      s.loop = !!action.loop;
      s.loopEnd = clamp(action.loopEnd, 0, Math.min(...s.tracks.map(t => t.duration), Infinity));
      s.transitionMs = clamp(action.transitionMs, 0, 2000);
      s.offset = Math.min(s.offset, lengthOf(s));
      break;
    case 'tracks':
      if (s.status !== 'stopped') throw new Error('Zatrzymaj odtwarzanie przed zmianą listy plików.');
      s.tracks = copy(action.tracks);
      if (!s.tracks.some(t => t.id === s.selected)) s.selected = s.tracks[0]?.id ?? null;
      s.offset = 0;
      break;
    case 'preload': s.preload++; break;
    default: throw new Error('Nieznane polecenie.');
  }
  s.revision++;
  return s;
}
export function formatTime(t) {
  const seconds = Math.floor(Math.max(0, Number(t) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function validPath(path) {
  if (typeof path !== 'string' || !path.trim() || path.length > 4096) return false;
  return !/^(?:javascript|data|blob|file):/i.test(path.trim()) &&
    (!/^[a-z][a-z\d+.-]*:/i.test(path.trim()) || /^https?:\/\//i.test(path.trim()));
}
