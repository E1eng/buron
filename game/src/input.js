// Papan ketuk BURON. Arah dibaca sebagai tombol yang sedang ditahan, sedangkan interaksi,
// konfirmasi, jeda, dan tembakan antre sebagai aksi sekali pakai agar tidak terlewat antar-frame.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_FIRE = 8;
export const ACTION_NEW = 16;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const DIRECTIONS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);
const ACTIONS = new Map([
  ['KeyE', ACTION_INTERACT],
  ['KeyN', ACTION_NEW],
  ['Space', ACTION_CONFIRM],
  ['Enter', ACTION_CONFIRM],
  ['KeyP', ACTION_PAUSE],
  ['Escape', ACTION_PAUSE],
  ['KeyF', ACTION_FIRE],
]);

function anyHeld(held, codes) {
  for (const code of codes) if (held.has(code)) return true;
  return false;
}

export function createInput(target) {
  const held = new Set();
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (DIRECTIONS.has(event.code)) {
      held.add(event.code);
    } else if (ACTIONS.has(event.code)) {
      if (!event.repeat) actions |= ACTIONS.get(event.code);
    } else {
      return;
    }
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    if (!DIRECTIONS.has(event.code) && !ACTIONS.has(event.code)) return;
    held.delete(event.code);
    event.preventDefault();
  });

  // Keyup dapat hilang ketika tab berpindah fokus.
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    /** Vektor arah mentah; dunia menormalkan gerak diagonal. */
    vector() {
      return {
        x: Number(anyHeld(held, RIGHT)) - Number(anyHeld(held, LEFT)),
        y: Number(anyHeld(held, DOWN)) - Number(anyHeld(held, UP)),
      };
    },
    /** Gabungan bendera ACTION_* sejak pengambilan terakhir. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
