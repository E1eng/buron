// Adegan tangkapan layar BURON. Semuanya memakai dunia, misi, dan renderer permainan;
// posisi yang ditata di sini tetap berupa state biasa dan tidak menambahkan aturan ke dunia.
import { ROAD, STEP, WANTED, WORLD } from './config.js';
import { createMissions } from './missions.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const DUSK_SECONDS = 30;
const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

const MARKET_TRAFFIC = [
  { x: 1440, y: 1370, direction: 1 },
  { x: 1440, y: 1960, direction: 3 },
  { x: 1150, y: 1440, direction: 0 },
  { x: 1760, y: 1920, direction: 2 },
  { x: 960, y: 1650, direction: 1 },
  { x: 1920, y: 1720, direction: 3 },
];

const MARKET_PEDESTRIANS = [
  [1392, 1550], [1415, 1605], [1388, 1730], [1420, 1815],
  [1484, 1510], [1490, 1788], [1510, 1450], [1510, 1535],
  [1510, 1755], [1510, 1860], [1300, 1435], [1240, 1465],
  [1650, 1460], [1740, 1420], [1550, 1900], [1710, 1935],
  [1200, 1890], [1810, 1880],
];

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function centerCamera(state, x = state.player.x, y = state.player.y) {
  const camera = state.camera;
  camera.x = clamp(x - camera.width / 2, 0, Math.max(0, WORLD.width - camera.width));
  camera.y = clamp(y - camera.height / 2, 0, Math.max(0, WORLD.height - camera.height));
}

function nextIntersection(x, y, direction) {
  const vector = DIRECTIONS[direction];
  return {
    x: vector.x > 0 ? (Math.floor(x / ROAD.spacing) + 1) * ROAD.spacing
      : vector.x < 0 ? (Math.ceil(x / ROAD.spacing) - 1) * ROAD.spacing : x,
    y: vector.y > 0 ? (Math.floor(y / ROAD.spacing) + 1) * ROAD.spacing
      : vector.y < 0 ? (Math.ceil(y / ROAD.spacing) - 1) * ROAD.spacing : y,
  };
}

function placeTraffic(car, placement, speed = 115) {
  const { x, y, direction } = placement;
  car.x = x;
  car.y = y;
  car.angle = direction * Math.PI / 2;
  car.speed = speed;
  car.driver = 'npc';
  car.traffic = true;
  car.trafficDirection = direction;
  car.trafficTarget = nextIntersection(x, y, direction);
  car.trafficPause = 0;
}

function placePedestrians(state, placements) {
  for (let index = 0; index < placements.length; index += 1) {
    const ped = state.peds[index];
    if (!ped) break;
    const [x, y] = placements[index];
    ped.x = x;
    ped.y = y;
    ped.angle = (index % 4) * Math.PI / 2;
    ped.down = false;
    ped.state = 'walk';
    ped.panic = 0;
    ped.speed = ped.baseSpeed ?? 42;
  }
}

function stageMarketLife(state) {
  const traffic = state.cars.filter((car) => !car.police);
  for (let index = 0; index < MARKET_TRAFFIC.length; index += 1) {
    placeTraffic(traffic[index], MARKET_TRAFFIC[index]);
  }
  placePedestrians(state, MARKET_PEDESTRIANS);
}

function activateMission(world, missions, index) {
  const state = world.state;
  missions.reset(world);
  missions.state.index = index;
  const rosa = state.places?.rosa ?? state.warung;
  state.player.x = rosa.x - 30;
  state.player.y = rosa.y;
  // Offer di dekat Mama Rosa diaktifkan lewat alur misi yang sama dengan permainan.
  missions.update(0, world);
}

function scene(screen, state, missions, overKind = null) {
  centerCamera(state);
  return {
    screen,
    best: state.player.money ?? 0,
    mission: missions.state,
    overKind,
  };
}

export function stageShot(name, world, missions = createMissions()) {
  world.reset();
  const state = world.state;

  if (name === 'play') {
    activateMission(world, missions, 0);
    stageMarketLife(state);
    state.elapsed = DUSK_SECONDS;
    return scene(SCREEN_PLAY, state, missions);
  }

  if (name === 'chase') {
    activateMission(world, missions, 4);
    state.player.money = 1400;

    // Wanted diturunkan oleh world.step, yang sekaligus memakai spawner polisi asli.
    state.wantedHeat = WANTED.thresholds[2];
    state.wanted = 3;
    world.step(STEP);

    const playerCar = state.cars.find((car) => car.missionTarget && !car.police)
      ?? state.cars.find((car) => !car.police);
    playerCar.x = 2400;
    playerCar.y = 1500;
    playerCar.angle = -Math.PI / 2;
    playerCar.speed = 265;
    playerCar.driver = 'player';
    playerCar.traffic = false;
    state.player.car = playerCar;
    state.player.x = playerCar.x;
    state.player.y = playerCar.y;

    // Biarkan misi memperbarui objektif untuk mobil yang benar-benar dikemudikan Raka.
    missions.update(0, world);
    state.wantedHeat = WANTED.thresholds[2];
    state.crimeHeat = state.wantedHeat;
    state.wanted = 3;
    state.wantedFlash = 1.35;
    state.policeSeeing = true;

    // Dua patroli berdampingan tepat di belakang; mobil ketiga menyusul lebih jauh.
    const pursuit = [
      { x: 2345, y: 1610 },
      { x: 2455, y: 1610 },
      { x: 2400, y: 1770 },
    ];
    for (let index = 0; index < state.cops.length; index += 1) {
      const cop = state.cops[index];
      const placement = pursuit[index] ?? { x: 2400, y: 1870 + index * 110 };
      cop.x = placement.x;
      cop.y = placement.y;
      cop.angle = -Math.PI / 2;
      cop.speed = 235;
      cop.officer = null;
      cop.onFoot = false;
      cop.traffic = false;
      cop.trafficPause = 0;
    }

    const traffic = state.cars.filter((car) => !car.police && car !== playerCar);
    const placements = [
      { x: 2400, y: 1300, direction: 3 },
      { x: 2170, y: 1440, direction: 0 },
      { x: 2740, y: 1440, direction: 2 },
      { x: 2880, y: 1260, direction: 1 },
    ];
    for (let index = 0; index < placements.length; index += 1) {
      placeTraffic(traffic[index], placements[index], 135);
    }
    placePedestrians(state, [
      [2328, 1270], [2472, 1310], [2328, 1390], [2472, 1500],
      [2328, 1570], [2472, 1690], [2220, 1510], [2660, 1370],
    ]);
    state.elapsed = 55;
    return scene(SCREEN_PLAY, state, missions);
  }

  if (name === 'end') {
    activateMission(world, missions, 5);
    state.player.money = 2150;
    // Misi 6 (index 5) diselesaikan di titik ferinya, bukan dengan memalsukan layar akhir.
    state.player.x = missions.state.objective.x;
    state.player.y = missions.state.objective.y;
    missions.update(STEP, world);
    state.elapsed = 90;
    return scene(SCREEN_OVER, state, missions, 'ending');
  }

  // Sampul tetap memperlihatkan Pasar Lama yang hidup di balik panel judul.
  missions.reset(world);
  stageMarketLife(state);
  state.elapsed = DUSK_SECONDS;
  return scene(SCREEN_TITLE, state, missions);
}
