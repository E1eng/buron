// Boot dan satu loop BURON: input dibaca tiap frame, dunia maju dengan langkah tetap 1/60 detik,
// dan renderer melukis keadaan terkini. ?seed=N menentukan kota; ?shot=start|play|chase|end menata satu
// adegan, melukisnya dua kali, lalu menandai window.__shotReady untuk pengambilan tangkapan layar.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_SHOT } from './world.js';
import { createMissions } from './missions.js';
import { captureProgress, createSaveStore, restoreProgress } from './save.js';
import {
  ACTION_CONFIRM,
  ACTION_FIRE,
  ACTION_INTERACT,
  ACTION_NEW,
  ACTION_PAUSE,
  createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import {
  busted as playBusted,
  cash as playCash,
  enginePitch,
  engineStart,
  engineStop,
  shot as playShot,
  sirenTick,
} from './audio.js';

/** Bingkai yang lebih panjang dari ini dibuang, bukan diputar ulang setelah tab tersembunyi. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const missions = createMissions();
const store = !shot && typeof localStorage !== 'undefined'
  ? createSaveStore(localStorage)
  : null;
const savedProgress = store?.load() ?? null;
if (savedProgress) restoreProgress(savedProgress, world, missions);
else missions.startNext(world);
const renderer = createRenderer(canvas);

function runShot(name) {
  window.__shotReady = false;
  const scene = stageShot(name, world, missions);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, missions.state, scene.overKind ?? null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let overKind = null;
  let best = savedProgress?.money ?? 0;
  let hasSave = savedProgress !== null;
  let lastSaved = savedProgress ?? captureProgress(world, missions);
  let accumulator = 0;
  let last = performance.now();
  let queuedInteract = false;
  let queuedFire = false;

  function announce(message) {
    status.textContent = message;
  }

  function clearQueuedActions() {
    queuedInteract = false;
    queuedFire = false;
  }

  function startGame(clearSave = false) {
    if (clearSave) {
      store?.clear();
      hasSave = false;
      lastSaved = null;
    }
    world.reset();
    missions.reset(world);
    overKind = null;
    accumulator = 0;
    clearQueuedActions();
    screen = SCREEN_PLAY;
    announce("BURON. You're Raka, back on the streets of Tanjung.");
  }

  function continueGame() {
    overKind = null;
    accumulator = 0;
    clearQueuedActions();
    screen = SCREEN_PLAY;
    announce('BURON. Back where you left off.');
  }

  function finishGame(kind) {
    screen = SCREEN_OVER;
    overKind = kind;
    clearQueuedActions();
    if (kind === 'ending') announce('THE END. Raka caught the last ferry out of Tanjung. Press Space to play again');
    else if (kind === 'wasted') announce('WASTED. Press Space or click to run it back');
    else announce('BUSTED. Press Space or click to run it back');
  }

  function pauseGame() {
    screen = SCREEN_PAUSED;
    clearQueuedActions();
    announce('PAUSED. Press P to resume');
  }

  function resumeGame() {
    screen = SCREEN_PLAY;
    accumulator = 0;
    announce('BURON. Back on the run.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (hasSave && (actions & ACTION_NEW)) startGame(true);
      else if (actions & ACTION_CONFIRM) {
        if (hasSave) continueGame();
        else startGame();
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_CONFIRM | ACTION_PAUSE)) resumeGame();
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_PAUSE) {
      pauseGame();
      return;
    }
    // Simpan aksi sekali pakai sampai ada langkah simulasi yang dapat mengonsumsinya.
    queuedInteract ||= Boolean(actions & ACTION_INTERACT);
    queuedFire ||= Boolean(actions & ACTION_FIRE);
  }

  function updateBest() {
    const money = world.state.player.money ?? 0;
    if (money > best) best = money;
  }

  function autosave() {
    if (!store) return;
    const current = captureProgress(world, missions);
    const changed = !lastSaved
      || current.money !== lastSaved.money
      || current.index !== lastSaved.index
      || current.complete !== lastSaved.complete
      || current.gun !== lastSaved.gun
      || current.ending !== lastSaved.ending;
    if (changed && store.save(current)) {
      lastSaved = current;
      hasSave = true;
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP);
      return;
    }
    const { x, y } = input.vector();
    const control = { x, y, interact: queuedInteract, fire: queuedFire };
    clearQueuedActions();
    const previousMissionPhase = missions.state.phase;
    const events = world.step(STEP, control);
    missions.update(STEP, world, events);
    if (events & EVENT_SHOT) playShot();
    if (previousMissionPhase === 'active'
      && (missions.state.phase === 'offer' || missions.state.phase === 'done')) {
      playCash();
    }
    updateBest();
    if (world.state.busted || world.state.wasted) playBusted();
    if (missions.state.ending) finishGame('ending');
    else if (world.state.busted) finishGame('busted');
    else if (world.state.wasted) finishGame('wasted');
  }

  function updateAudio() {
    const car = world.state.player.car;
    if (screen === SCREEN_PLAY && car) {
      engineStart();
      const speedRatio = Math.min(1, Math.abs(car.speed) / Math.max(1, car.type.maxSpeed));
      enginePitch(800 + speedRatio * 5200);
    } else {
      engineStop();
    }
    if (screen === SCREEN_PLAY && world.state.wanted > 0 && world.state.policeSeeing) {
      sirenTick(world.state.wanted);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    autosave();
    updateAudio();
    renderer.draw(world.state, screen, best, missions.state, overKind, hasSave);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) pauseGame();
  });

  announce(hasSave ? 'BURON. Enter: Continue · N: New Game' : 'BURON. Enter: Start');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
