// Satu simpanan lokal untuk melanjutkan cerita. Modul ini tidak mengambil localStorage sendiri,
// sehingga mode tangkapan layar dapat sepenuhnya menghindarinya dan pengujian dapat memakai stub.
import { SAVE_KEY } from './config.js';

function normalize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!Number.isFinite(value.money) || value.money < 0) return null;
  if (!Number.isInteger(value.index) || value.index < 0) return null;
  return {
    money: value.money,
    index: value.index,
    gun: value.gun === true,
    complete: value.complete === true,
    ending: value.ending === true,
  };
}

export function createSaveStore(storage) {
  return {
    load() {
      try {
        const raw = storage?.getItem(SAVE_KEY);
        return raw === null || raw === undefined ? null : normalize(JSON.parse(raw));
      } catch {
        return null;
      }
    },

    save(progress) {
      const value = normalize(progress);
      if (!value) return false;
      try {
        storage?.setItem(SAVE_KEY, JSON.stringify(value));
        return Boolean(storage);
      } catch {
        return false;
      }
    },

    clear() {
      try {
        storage?.removeItem(SAVE_KEY);
        return Boolean(storage);
      } catch {
        return false;
      }
    },
  };
}

export function captureProgress(world, missions) {
  return {
    money: world.state.player.money ?? 0,
    index: missions.state.index,
    gun: world.state.player.gun === true,
    complete: missions.state.complete === true,
    ending: missions.state.ending === true,
  };
}

/** Pulihkan ke world/missions baru; index menunjuk misi berikutnya yang belum selesai. */
export function restoreProgress(progress, world, missions) {
  const saved = normalize(progress);
  if (!saved) return null;

  world.reset();
  missions.reset(world);
  world.state.player.money = saved.money;
  world.state.player.gun = saved.gun;
  missions.state.index = saved.index;
  missions.state.complete = saved.complete;
  missions.state.ending = saved.ending;
  missions.startNext(world);

  if (saved.complete || saved.ending) {
    missions.state.complete = true;
    missions.state.ending = saved.ending;
    missions.state.phase = 'done';
    missions.state.objective = null;
  }
  return captureProgress(world, missions);
}
