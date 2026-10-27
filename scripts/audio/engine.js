import {position, lengthOf, drift} from './core.js';

// Transport is authoritative; only the selected Sound is ever audible.
// Loads can run concurrently; actual audio transitions are serialized and
// stale requests are discarded before and after each asynchronous operation.
export class TimelineEngine {
  constructor({create, now, unlocked, gain, report = () => {}}) {
    Object.assign(this, {create, now, unlocked, gain, report});
    this.cache = new Map(); this.current = null; this.state = null;
    this.generation = 0; this.tail = Promise.resolve(); this.pending = false;
  }
  async load(track) {
    if (!this.cache.has(track.path)) {
      const sound = this.create(track.path);
      let timer;
      const ready = Promise.race([
        sound.load({autoplay: false}),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Przekroczono 45 s ładowania pliku.')), 45000); })
      ]).then(() => {
        if (!Number.isFinite(sound.duration) || sound.duration <= 0) throw new Error('Nieprawidłowa długość audio.');
        return sound;
      }).catch(error => { this.cache.delete(track.path); throw error; }).finally(() => clearTimeout(timer));
      this.cache.set(track.path, {sound, ready});
    }
    return this.cache.get(track.path).ready;
  }
  async preload(tracks) {
    const failures = [];
    for (const track of tracks) {
      try { await this.load(track); }
      catch (error) { failures.push(track.name); this.report(`Nie można wczytać ${track.name}: ${error.message}`, true); }
    }
    return failures;
  }
  accept(state) {
    this.state = state;
    this.failed = false;
    const generation = ++this.generation;
    this.pending = true;
    return this.apply(generation).catch(error => {
      if (generation === this.generation) { this.failed = true; this.report(error.message, true); }
    }).finally(() => { if (generation === this.generation) this.pending = false; });
  }
  async stopCurrent(fade = 0) {
    const current = this.current;
    this.current = null;
    if (current) await current.sound.stop({fade});
  }
  async apply(generation) {
    const requested = this.state;
    const track = requested.tracks.find(t => t.id === requested.selected);
    let sound;
    if (requested.status === 'playing' && track) {
      await this.unlocked();
      if (generation !== this.generation) return;
      this.report(`Wczytywanie: ${track.name}`);
      try { sound = await this.load(track); }
      catch (error) {
        if (generation === this.generation) {
          this.tail = this.tail.catch(() => {}).then(() => generation === this.generation ? this.stopCurrent(0) : undefined);
          await this.tail;
        }
        throw error;
      }
    }
    if (generation !== this.generation) return;
    const job = async () => {
      if (generation !== this.generation) return;
      const s = this.state;
      const duration = lengthOf(s);
      if (s.status !== 'playing' || !sound || (!s.loop && position(s, this.now()) >= duration)) {
        await this.stopCurrent(0);
        this.report(s.status === 'paused' ? 'Pauza' : 'Zatrzymano');
        return;
      }
      const target = position(s, this.now());
      const volume = Math.min(1, s.volume * this.gain());
      const same = this.current?.sound === sound && sound.playing &&
        this.current.loop === s.loop && this.current.duration === duration &&
        drift(s.loop ? sound.currentTime % duration : sound.currentTime, target, duration, s.loop) < 0.4;
      if (same) { await sound.fade(volume, {duration: 60}); this.report('Odtwarzanie'); return; }

      // Fade out completely BEFORE starting the next version: no doubled melody.
      await this.stopCurrent(s.transitionMs / 2);
      if (generation !== this.generation) return;
      const offset = position(s, this.now());
      if (!s.loop && offset >= duration) return;
      await sound.play({offset, loop: s.loop, loopStart: 0, loopEnd: duration,
        duration: s.loop ? undefined : duration - offset, volume, fade: s.transitionMs / 2});
      if (generation !== this.generation) { await sound.stop({fade: 0}); return; }
      this.current = {sound, id: track.id, duration, loop: s.loop};
      this.report('Odtwarzanie');
    };
    this.tail = this.tail.catch(() => {}).then(job);
    await this.tail;
  }
  tick() {
    const s = this.state;
    if (!s || this.pending || this.failed || s.status !== 'playing') return;
    const duration = lengthOf(s), target = position(s, this.now());
    if (!s.loop && target >= duration) {
      if (this.current) void this.accept(s);
      return;
    }
    const actual = this.current?.sound.currentTime ?? 0;
    if (!this.current?.sound.playing || drift(s.loop ? actual % duration : actual, target, duration, s.loop) > 0.65) {
      void this.accept(s);
    }
  }
  prune(tracks) {
    const keep = new Set(tracks.map(t => t.path));
    for (const [path, item] of this.cache) {
      if (!keep.has(path) && item.sound !== this.current?.sound) this.cache.delete(path);
    }
  }
}
