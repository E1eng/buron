// Model dunia BURON yang independen dari DOM dan kanvas. Denah Kota Tanjung dibangun sekali
// dari RNG pemberian pemanggil; reset hanya memulai ulang keadaan Raka, bukan mengacak kota.
import { CAR, PALETTE, PLAYER, POLICE, ROAD, VIEW, WANTED, WORLD } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_PED_DOWN = 1;
export const EVENT_BUSTED = 2;
export const EVENT_WASTED = 4;
export const EVENT_SHOT = 8;

const ROAD_HALF = ROAD.width / 2;
const COAST_X = WORLD.width - ROAD.spacing * 1.5;
const LAST_ROAD_X = Math.floor((COAST_X - ROAD.spacing / 2) / ROAD.spacing) * ROAD.spacing;
const PIER_LENGTH = 470;
const PIER_WIDTH = 84;
const MARKET_COLUMNS = [2, 3];
const MARKET_ROWS = [2, 4];
const ROSA_BLOCK = { column: 3, row: 3 };
const STATIONARY = { x: 0, y: 0 };
const TRAFFIC_CAR_INDICES = new Set([1, 4, 7, 10, 14, 17, 20, 23, 26, 29]);
const TRAFFIC_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];
const TRAFFIC_SPEED = 135;
const TRAFFIC_HIT_PAUSE = 1.4;
const PED_COUNT = 40;
const MARKET_PED_COUNT = 16;
const PED_RADIUS = 6;
const PED_CROSSING_CHANCE = 0.1;
const PED_FAST_CAR_SPEED = 80;
const PED_PANIC_RADIUS = 90;
const PED_PANIC_DURATION = 3;
const PED_PANIC_MULTIPLIER = 2.5;
const PED_DOWN_CRIME_HEAT = 65;
const SHOT_CRIME_HEAT = 35;
const SHOT_PED_CRIME_HEAT = 150;
const SHOT_RANGE = 260;
const SHOT_CONE_COSINE = Math.cos(Math.PI / 12);
const SHOT_PANIC_RADIUS = 200;
const SHOT_FLASH_DURATION = 0.1;
const THUG_SPEED = 170;
const THUG_SIGHT_DISTANCE = 420;
const THUG_HIT_DISTANCE = 26;
const THUG_DAMAGE_PER_SECOND = 6;
const CAR_THEFT_HEAT = 120;
const HARD_CAR_CRIME_HEAT = 85;
const WITNESS_DISTANCE = 380;
const POLICE_SIGHT_DISTANCE = 440;
const POLICE_SPAWN_MIN_DISTANCE = 650;
const POLICE_SPAWN_MAX_DISTANCE = 1150;
const POLICE_CAR_ACCELERATION = 235;
const POLICE_FOOT_SPEED = 215;
const POLICE_EXIT_DISTANCE = 145;
const BUSTED_SECONDS = 2;
const BUSTED_SLOW_SPEED = 24;
const HARD_CRASH_SPEED = 155;
const FAST_CRASH_CRIME_SPEED = 175;
const CRASH_DAMAGE_COOLDOWN = 0.55;
const HEAT_DECAY_DELAY = 4;
const HEAT_DECAY_RATE = 18;
const PED_SHIRTS = ['#d88761', '#79a9d1', '#d7c6a1', '#a8674d', '#49734b', '#b6a99c', '#77515a', '#efd3a1'];
const LAST_ROAD_Y = Math.floor((WORLD.height - 1) / ROAD.spacing) * ROAD.spacing;
const POLICE_CAR_TYPE = {
  name: 'polisi',
  kind: 'polisi',
  length: 96,
  width: 46,
  maxSpeed: POLICE.speed,
  acceleration: POLICE_CAR_ACCELERATION,
  colors: ['#315f85'],
};

function wantedFromHeat(heat) {
  let stars = 0;
  for (let index = 0; index < WANTED.thresholds.length; index += 1) {
    if (heat >= WANTED.thresholds[index]) stars = index + 1;
  }
  return Math.min(stars, WANTED.maxStars);
}

function normalizeAngle(angle) {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function blockRectangle(column, row) {
  const size = ROAD.spacing - ROAD.width - ROAD.sidewalk * 2;
  return {
    x: column * ROAD.spacing + ROAD_HALF + ROAD.sidewalk,
    y: row * ROAD.spacing + ROAD_HALF + ROAD.sidewalk,
    width: size,
    height: size,
  };
}

function belongsToMarket(column, row) {
  return column >= MARKET_COLUMNS[0] && column <= MARKET_COLUMNS[1]
    && row >= MARKET_ROWS[0] && row <= MARKET_ROWS[1];
}

// Sebuah lingkaran boleh menyentuh sisi luar rect; hanya penetrasi yang dihitung tabrakan.
function circleIntersectsRect(x, y, radius, rect) {
  const closestX = clamp(x, rect.x, rect.x + rect.width);
  const closestY = clamp(y, rect.y, rect.y + rect.height);
  const offsetX = x - closestX;
  const offsetY = y - closestY;
  return offsetX * offsetX + offsetY * offsetY < radius * radius;
}

const PARKING_SPOTS = [
  // Pasar Lama, termasuk satu mobil kosong tepat di selatan tempat Raka muncul.
  { direction: 'vertical', road: 1440, along: 1740, side: 1 },
  { direction: 'vertical', road: 1440, along: 1240, side: -1 },
  { direction: 'vertical', road: 1440, along: 2140, side: 1 },
  { direction: 'vertical', road: 960, along: 1200, side: -1 },
  { direction: 'vertical', road: 960, along: 1660, side: 1 },
  { direction: 'vertical', road: 960, along: 2140, side: -1 },
  { direction: 'vertical', road: 1920, along: 1200, side: 1 },
  { direction: 'vertical', road: 1920, along: 1660, side: -1 },
  { direction: 'vertical', road: 1920, along: 2140, side: 1 },
  { direction: 'horizontal', road: 960, along: 1160, side: -1 },
  { direction: 'horizontal', road: 960, along: 1640, side: 1 },
  { direction: 'horizontal', road: 960, along: 2140, side: -1 },
  { direction: 'horizontal', road: 1440, along: 1120, side: -1 },
  { direction: 'horizontal', road: 1440, along: 2100, side: 1 },
  { direction: 'horizontal', road: 1920, along: 1160, side: -1 },
  { direction: 'horizontal', road: 1920, along: 2140, side: 1 },
  { direction: 'horizontal', road: 2400, along: 1640, side: 1 },
  // Sisa kendaraan tersebar di tepi jalan bagian kota dan pelabuhan.
  { direction: 'vertical', road: 480, along: 500, side: 1 },
  { direction: 'vertical', road: 480, along: 3000, side: -1 },
  { direction: 'vertical', road: 2880, along: 780, side: 1 },
  { direction: 'vertical', road: 2880, along: 2800, side: -1 },
  { direction: 'vertical', road: 3360, along: 1380, side: 1 },
  { direction: 'vertical', road: 3360, along: 3060, side: -1 },
  { direction: 'vertical', road: 3840, along: 3300, side: 1 },
  { direction: 'horizontal', road: 480, along: 680, side: 1 },
  { direction: 'horizontal', road: 480, along: 3320, side: -1 },
  { direction: 'horizontal', road: 2880, along: 600, side: 1 },
  { direction: 'horizontal', road: 2880, along: 3200, side: -1 },
  { direction: 'horizontal', road: 3360, along: 1000, side: 1 },
  { direction: 'horizontal', road: 3360, along: 2900, side: -1 },
];

function nextTrafficIntersection(x, y, direction) {
  const vector = TRAFFIC_DIRECTIONS[direction];
  return {
    x: vector.x > 0 ? (Math.floor(x / ROAD.spacing) + 1) * ROAD.spacing
      : vector.x < 0 ? (Math.ceil(x / ROAD.spacing) - 1) * ROAD.spacing : x,
    y: vector.y > 0 ? (Math.floor(y / ROAD.spacing) + 1) * ROAD.spacing
      : vector.y < 0 ? (Math.ceil(y / ROAD.spacing) - 1) * ROAD.spacing : y,
  };
}

function makeParkedCars(random) {
  return PARKING_SPOTS.map((spot, index) => {
    const type = CAR.types[Math.floor(random() * CAR.types.length)];
    const traffic = TRAFFIC_CAR_INDICES.has(index);
    const roadsideOffset = traffic ? 0 : ROAD_HALF - type.width / 2 - 5;
    const vertical = spot.direction === 'vertical';
    const x = vertical ? spot.road + spot.side * roadsideOffset : spot.along;
    const y = vertical ? spot.along : spot.road + spot.side * roadsideOffset;
    const trafficDirection = vertical ? (spot.side > 0 ? 1 : 3) : (spot.side > 0 ? 0 : 2);
    return {
      x,
      y,
      angle: trafficDirection * Math.PI / 2,
      type,
      speed: 0,
      hp: 100,
      driver: index % 8 === 5 ? 'npc' : null,
      traffic,
      trafficDirection,
      trafficTarget: traffic ? nextTrafficIntersection(x, y, trafficDirection) : null,
      trafficPause: 0,
    };
  });
}

// Trotoar adalah graf: sisi blok mengikuti jalan, sementara ruas pendek antarblok
// merupakan zebra cross. Pejalan tidak perlu menebak jalan di antara gedung.
function makePedestrianNetwork() {
  const nodes = [];
  const edges = [];
  const grid = [];
  const rowTotal = Math.floor(WORLD.height / ROAD.spacing);
  const columnTotal = LAST_ROAD_X / ROAD.spacing;
  const centerOffset = ROAD.sidewalk / 2;

  function connect(a, b, crossing = false) {
    nodes[a].links.push({ to: b, crossing });
    nodes[b].links.push({ to: a, crossing });
    edges.push({ a, b, crossing, market: nodes[a].market && nodes[b].market });
  }

  for (let row = 0; row < rowTotal; row += 1) {
    const line = [];
    grid.push(line);
    for (let column = 0; column < columnTotal; column += 1) {
      const left = column * ROAD.spacing + ROAD_HALF + centerOffset;
      const top = row * ROAD.spacing + ROAD_HALF + centerOffset;
      const right = Math.min(
        column * ROAD.spacing + ROAD_HALF + ROAD.spacing - ROAD.width,
        COAST_X,
      ) - centerOffset;
      const bottom = Math.min(
        row * ROAD.spacing + ROAD_HALF + ROAD.spacing - ROAD.width,
        WORLD.height,
      ) - centerOffset;
      const corners = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
      ];
      const indices = corners.map((corner) => {
        const index = nodes.length;
        nodes.push({ ...corner, market: belongsToMarket(column, row), links: [] });
        return index;
      });
      line.push(indices);
      for (let corner = 0; corner < 4; corner += 1) {
        connect(indices[corner], indices[(corner + 1) % 4]);
      }
    }
  }

  // Hubungkan sudut-sudut yang berseberangan dengan ruas lurus melintasi aspal.
  for (let row = 0; row < rowTotal; row += 1) {
    for (let column = 0; column < columnTotal; column += 1) {
      if (column + 1 < columnTotal) {
        connect(grid[row][column][1], grid[row][column + 1][0], true);
        connect(grid[row][column][2], grid[row][column + 1][3], true);
      }
      if (row + 1 < rowTotal) {
        connect(grid[row][column][3], grid[row + 1][column][0], true);
        connect(grid[row][column][2], grid[row + 1][column][1], true);
      }
    }
  }
  return { nodes, edges };
}

function makePedestrians(network, random) {
  const marketEdges = network.edges.filter((edge) => edge.market && !edge.crossing);
  const outerEdges = network.edges.filter((edge) => !edge.market && !edge.crossing);
  const peds = [];

  for (let index = 0; index < PED_COUNT; index += 1) {
    const pool = index < MARKET_PED_COUNT ? marketEdges : outerEdges;
    const edge = pool[Math.floor(random() * pool.length)];
    let from = edge.a;
    let to = edge.b;
    if (random() < 0.5) [from, to] = [to, from];
    const a = network.nodes[from];
    const b = network.nodes[to];
    const progress = 0.1 + random() * 0.8;
    const speed = 34 + random() * 18;
    peds.push({
      x: a.x + (b.x - a.x) * progress,
      y: a.y + (b.y - a.y) * progress,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      speed,
      panic: 0,
      down: false,
      state: 'walk',
      color: PED_SHIRTS[Math.floor(random() * PED_SHIRTS.length)],
      radius: PED_RADIUS,
      baseSpeed: speed,
      routeFrom: from,
      routeTo: to,
      panicX: 0,
      panicY: 0,
    });
  }
  return peds;
}

function choosePedTarget(ped, network, random, panicking) {
  const current = ped.routeTo;
  const previous = ped.routeFrom;
  const node = network.nodes[current];
  let choices = node.links;

  if (panicking) {
    // Tetap di trotoar/zebra cross, tetapi ambil arah yang paling menjauhi bahaya.
    const awayX = node.x - ped.panicX;
    const awayY = node.y - ped.panicY;
    const awayLength = Math.hypot(awayX, awayY);
    let bestScore = -Infinity;
    let best = choices[0];
    for (const choice of choices) {
      const target = network.nodes[choice.to];
      const dx = target.x - node.x;
      const dy = target.y - node.y;
      const length = Math.hypot(dx, dy);
      const score = awayLength > 0 && length > 0
        ? (dx * awayX + dy * awayY) / (length * awayLength)
        : 0;
      if (score > bestScore) {
        bestScore = score;
        best = choice;
      }
    }
    choices = [best];
  } else {
    const onward = choices.filter((choice) => choice.to !== previous);
    if (onward.length) choices = onward;
    if (random() >= PED_CROSSING_CHANCE) {
      const sidewalks = choices.filter((choice) => !choice.crossing);
      if (sidewalks.length) choices = sidewalks;
    }
  }

  const choice = choices[Math.floor(random() * choices.length)];
  ped.routeFrom = current;
  ped.routeTo = choice.to;
}

function advancePed(ped, network, random, dt) {
  const panicking = ped.panic > 0;
  ped.state = panicking ? 'panic' : 'walk';
  ped.speed = ped.baseSpeed * (panicking ? PED_PANIC_MULTIPLIER : 1);
  let remaining = ped.speed * dt;
  let turns = 0;
  while (remaining > 0 && turns < 12) {
    const target = network.nodes[ped.routeTo];
    const dx = target.x - ped.x;
    const dy = target.y - ped.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= remaining) {
      ped.x = target.x;
      ped.y = target.y;
      remaining -= distance;
      choosePedTarget(ped, network, random, panicking);
      turns += 1;
    } else {
      ped.angle = Math.atan2(dy, dx);
      ped.x += dx / distance * remaining;
      ped.y += dy / distance * remaining;
      remaining = 0;
    }
  }
  if (panicking) ped.panic = Math.max(0, ped.panic - dt);
}

function triggerPedPanic(ped, danger, network) {
  if (ped.panic <= 0) {
    const target = network.nodes[ped.routeTo];
    const routeX = target.x - ped.x;
    const routeY = target.y - ped.y;
    const awayX = ped.x - danger.x;
    const awayY = ped.y - danger.y;
    if (routeX * awayX + routeY * awayY < 0) {
      [ped.routeFrom, ped.routeTo] = [ped.routeTo, ped.routeFrom];
    }
  }
  ped.panic = PED_PANIC_DURATION;
  ped.panicX = danger.x;
  ped.panicY = danger.y;
}

function carTouchesPed(car, ped) {
  const cosine = Math.cos(car.angle);
  const sine = Math.sin(car.angle);
  const dx = ped.x - car.x;
  const dy = ped.y - car.y;
  const localX = dx * cosine + dy * sine;
  const localY = -dx * sine + dy * cosine;
  const closestX = clamp(localX, -car.type.length / 2, car.type.length / 2);
  const closestY = clamp(localY, -car.type.width / 2, car.type.width / 2);
  const offsetX = localX - closestX;
  const offsetY = localY - closestY;
  const radius = ped.radius ?? PED_RADIUS;
  return offsetX * offsetX + offsetY * offsetY < radius * radius;
}

function carsOverlap(x, y, angle, type, other) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const otherCosine = Math.cos(other.angle);
  const otherSine = Math.sin(other.angle);
  const axes = [
    [cosine, sine],
    [-sine, cosine],
    [otherCosine, otherSine],
    [-otherSine, otherCosine],
  ];
  for (const [axisX, axisY] of axes) {
    const distance = Math.abs((other.x - x) * axisX + (other.y - y) * axisY);
    const radius = type.length / 2 * Math.abs(cosine * axisX + sine * axisY)
      + type.width / 2 * Math.abs(-sine * axisX + cosine * axisY);
    const otherRadius = other.type.length / 2
      * Math.abs(otherCosine * axisX + otherSine * axisY)
      + other.type.width / 2 * Math.abs(-otherSine * axisX + otherCosine * axisY);
    if (distance >= radius + otherRadius) return false;
  }
  return true;
}

function makeStreetNetwork() {
  const streets = [];

  for (let center = 0; center <= LAST_ROAD_X; center += ROAD.spacing) {
    const start = Math.max(0, center - ROAD_HALF);
    const end = Math.min(COAST_X, center + ROAD_HALF);
    streets.push({
      x: start,
      y: 0,
      width: end - start,
      height: WORLD.height,
      direction: 'vertical',
    });
  }

  for (let center = 0; center < WORLD.height; center += ROAD.spacing) {
    const start = Math.max(0, center - ROAD_HALF);
    const end = Math.min(WORLD.height, center + ROAD_HALF);
    streets.push({
      x: 0,
      y: start,
      width: COAST_X,
      height: end - start,
      direction: 'horizontal',
    });
  }

  return streets;
}

function constructBuilding(collection, random, x, y, width, height, district, kind = 'building') {
  // Warung memakai tinggi tetap dan karena itu tidak menghabiskan satu angka RNG untuk tinggi.
  let visualHeight = 18;
  if (kind !== 'warung') {
    visualHeight = 12 + random() * (district === 'Old Market' ? 26 : 44);
  }
  const color = PALETTE.roofs[Math.floor(random() * PALETTE.roofs.length)];
  const building = { x, y, width, height, visualHeight, color, district, kind };
  collection.push(building);
  return building;
}

function developBlock(block, crowded, buildings, random) {
  const district = crowded ? 'Old Market' : 'Tanjung City';
  const inset = crowded ? 5 : 9 + random() * 6;
  const gap = crowded ? 6 : 11 + random() * 5;
  const columnCount = crowded ? 2 + Math.floor(random() * 2) : 1 + Math.floor(random() * 2);
  const rowCount = crowded ? 2 + Math.floor(random() * 2) : 1 + Math.floor(random() * 2);
  const cellWidth = (block.width - inset * 2 - gap * (columnCount - 1)) / columnCount;
  const cellHeight = (block.height - inset * 2 - gap * (rowCount - 1)) / rowCount;
  const edgeJitter = crowded ? 3 : 7;

  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < columnCount; column += 1) {
      const x = block.x + inset + column * (cellWidth + gap);
      const y = block.y + inset + row * (cellHeight + gap);
      constructBuilding(
        buildings,
        random,
        x,
        y,
        cellWidth - random() * edgeJitter,
        cellHeight - random() * edgeJitter,
        district,
      );
    }
  }
}

function frameBlockWithSidewalks(collection, left, top, right, bottom) {
  collection.push({ x: left, y: top, width: right - left, height: ROAD.sidewalk });
  collection.push({
    x: left,
    y: bottom - ROAD.sidewalk,
    width: right - left,
    height: ROAD.sidewalk,
  });
  collection.push({
    x: left,
    y: top + ROAD.sidewalk,
    width: ROAD.sidewalk,
    height: bottom - top - ROAD.sidewalk * 2,
  });
  collection.push({
    x: right - ROAD.sidewalk,
    y: top + ROAD.sidewalk,
    width: ROAD.sidewalk,
    height: bottom - top - ROAD.sidewalk * 2,
  });
}

function populateCity(buildings, sidewalks, props, random) {
  const rowTotal = Math.floor(WORLD.height / ROAD.spacing);
  const columnTotal = LAST_ROAD_X / ROAD.spacing;

  for (let row = 0; row < rowTotal; row += 1) {
    for (let column = 0; column < columnTotal; column += 1) {
      const left = column * ROAD.spacing + ROAD_HALF;
      const top = row * ROAD.spacing + ROAD_HALF;
      const right = Math.min(left + ROAD.spacing - ROAD.width, COAST_X);
      const bottom = Math.min(top + ROAD.spacing - ROAD.width, WORLD.height);
      if (right - left <= ROAD.sidewalk * 2 || bottom - top <= ROAD.sidewalk * 2) continue;

      // Tiap bingkai berhenti di tepi blok supaya aspal persimpangan tetap terbuka.
      frameBlockWithSidewalks(sidewalks, left, top, right, bottom);

      const block = blockRectangle(column, row);
      // Blok ini dibangun khusus di bawah: warung beserta pelatarannya.
      if (column === ROSA_BLOCK.column && row === ROSA_BLOCK.row) continue;
      developBlock(block, belongsToMarket(column, row), buildings, random);

      // Pohon dan lampu hanyalah hiasan; keduanya sengaja tidak menjadi penghalang gerak.
      if (random() < 0.7) {
        props.push({
          type: 'tree',
          x: block.x - ROAD.sidewalk / 2,
          y: block.y - ROAD.sidewalk / 2,
          radius: 11 + random() * 7,
          solid: false,
        });
      }
      if (random() < 0.8) {
        props.push({
          type: 'lamp',
          x: block.x + block.width + ROAD.sidewalk / 2,
          y: block.y + block.height + ROAD.sidewalk / 2,
          visualHeight: 42,
          solid: false,
        });
      }
    }
  }
}

function buildMamaRosaCorner(buildings, props, random) {
  const block = blockRectangle(ROSA_BLOCK.column, ROSA_BLOCK.row);
  const warungHeight = 92;

  constructBuilding(buildings, random, block.x, block.y, 124, 92, 'Old Market');
  constructBuilding(
    buildings,
    random,
    block.x,
    block.y + block.height - 92,
    124,
    92,
    'Old Market',
  );
  constructBuilding(
    buildings,
    random,
    block.x + 144,
    block.y + 10,
    block.width - 144,
    block.height - 20,
    'Old Market',
  );

  const centerY = block.y + (block.height - warungHeight) / 2;
  const shop = constructBuilding(
    buildings,
    random,
    block.x,
    centerY,
    126,
    warungHeight,
    'Old Market',
    'warung',
  );
  shop.name = "Mama Rosa's Corner Shop";

  // Pintu dan titik pertemuan berada di sisi barat, dekat jalan tempat Raka muncul.
  const warung = { name: 'Mama Rosa', x: shop.x - 8, y: shop.y + shop.height / 2 };
  props.push({ type: 'warung-sign', x: warung.x, y: warung.y, color: PALETTE.warungNeon, solid: false });
  const spawn = { x: ROSA_BLOCK.column * ROAD.spacing, y: warung.y };
  return { spawn, warung };
}

function makeDocks(props) {
  const piers = [];
  for (let index = 0; index < 3; index += 1) {
    const centerY = (index * 3 + 1) * ROAD.spacing;
    const pier = {
      x: COAST_X - 30,
      y: centerY - PIER_WIDTH / 2,
      width: PIER_LENGTH,
      height: PIER_WIDTH,
      kind: 'wood',
    };
    piers.push(pier);
    props.push({
      type: 'lamp',
      x: pier.x + pier.width - 28,
      y: pier.y + 13,
      visualHeight: 42,
      solid: false,
    });
  }
  return piers;
}

export function createWorld(random) {
  const buildings = [];
  const sidewalks = [];
  const props = [];
  const roads = makeStreetNetwork();

  populateCity(buildings, sidewalks, props, random);
  const mamaRosa = buildMamaRosaCorner(buildings, props, random);
  const docks = makeDocks(props);
  const cars = makeParkedCars(random);
  const pedestrianNetwork = makePedestrianNetwork();
  const peds = makePedestrians(pedestrianNetwork, random);
  const carCrashes = [];
  const spawn = mamaRosa.spawn;

  const player = { name: 'Raka', x: 0, y: 0, radius: PLAYER.radius, hp: PLAYER.hp, money: 0, car: null, gun: false, facing: 0 };
  const camera = { x: 0, y: 0, width: VIEW.width, height: VIEW.height };
  const water = { x: COAST_X, y: 0, width: WORLD.width - COAST_X, height: WORLD.height };
  const state = {
    player,
    cars,
    cops: [],
    peds,
    thugs: [],
    lastShot: null,
    wantedHeat: 0,
    wanted: 0,
    wantedFlash: 0,
    crimeHeat: 0,
    policeSeeing: false,
    unseenFor: 0,
    bustedMeter: 0,
    busted: false,
    wasted: false,
    crashDamageCooldown: 0,
    buildings,
    props,
    roads,
    sidewalks,
    docks,
    water,
    warung: mamaRosa.warung,
    places: { rosa: mamaRosa.warung },
    market: {
      name: 'Old Market',
      x: MARKET_COLUMNS[0] * ROAD.spacing,
      y: MARKET_ROWS[0] * ROAD.spacing,
      width: (MARKET_COLUMNS[1] - MARKET_COLUMNS[0] + 1) * ROAD.spacing,
      height: (MARKET_ROWS[1] - MARKET_ROWS[0] + 1) * ROAD.spacing,
    },
    camera,
    elapsed: 0,
  };

  function spawnThug(x, y) {
    const thug = {
      x,
      y,
      angle: 0,
      radius: 11,
      speed: THUG_SPEED,
      hp: 3,
      down: false,
      state: 'idle',
      contactTime: 0,
    };
    state.thugs.push(thug);
    return thug;
  }

  function fullyOnDock(x, y, radius) {
    for (const dock of docks) {
      const fitsX = x - radius >= dock.x && x + radius <= dock.x + dock.width;
      const fitsY = y - radius >= dock.y && y + radius <= dock.y + dock.height;
      if (fitsX && fitsY) return true;
    }
    return false;
  }

  function positionIsFree(x, y, radius) {
    const outsideWorld = x - radius < 0 || y - radius < 0
      || x + radius > WORLD.width || y + radius > WORLD.height;
    if (outsideWorld) return false;

    // Menyeberangi garis pantai hanya sah jika seluruh lingkaran tertopang satu dermaga.
    if (x + radius > COAST_X && !fullyOnDock(x, y, radius)) return false;
    for (const building of buildings) {
      if (circleIntersectsRect(x, y, radius, building)) return false;
    }
    return true;
  }

  function carPositionIsFree(x, y, angle, type) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const halfLength = type.length / 2;
    const halfWidth = type.width / 2;
    const extentX = Math.abs(cosine) * halfLength + Math.abs(sine) * halfWidth;
    const extentY = Math.abs(sine) * halfLength + Math.abs(cosine) * halfWidth;
    if (x - extentX < 0 || y - extentY < 0
      || x + extentX > COAST_X || y + extentY > WORLD.height) return false;

    // Uji sumbu mobil dan sumbu dunia (SAT): seluruh bodi mobil harus bebas dari gedung.
    const axes = [[1, 0], [0, 1], [cosine, sine], [-sine, cosine]];
    for (const building of buildings) {
      const centerX = building.x + building.width / 2;
      const centerY = building.y + building.height / 2;
      let separated = false;
      for (const [axisX, axisY] of axes) {
        const distance = Math.abs((centerX - x) * axisX + (centerY - y) * axisY);
        const carRadius = halfLength * Math.abs(cosine * axisX + sine * axisY)
          + halfWidth * Math.abs(-sine * axisX + cosine * axisY);
        const buildingRadius = building.width / 2 * Math.abs(axisX)
          + building.height / 2 * Math.abs(axisY);
        if (distance >= carRadius + buildingRadius) {
          separated = true;
          break;
        }
      }
      if (!separated) return false;
    }
    return true;
  }

  function syncWanted() {
    state.wanted = wantedFromHeat(state.wantedHeat);
    // Nama lama tetap disinkronkan agar penyimpanan/adegan lama tidak kehilangan panas kejahatan.
    state.crimeHeat = state.wantedHeat;
  }

  function addHeat(amount) {
    if (!(amount > 0) || state.busted || state.wasted) return;
    state.wantedHeat = Math.max(0, state.wantedHeat + amount);
    state.wantedFlash = 1.35;
    state.unseenFor = 0;
    syncWanted();
  }

  function damagePlayer(amount) {
    if (state.busted || state.wasted || state.crashDamageCooldown > 0) return;
    player.hp = Math.max(0, player.hp - amount);
    state.crashDamageCooldown = CRASH_DAMAGE_COOLDOWN;
  }

  function fireGun() {
    const facing = Number.isFinite(player.facing) ? player.facing : 0;
    const facingX = Math.cos(facing);
    const facingY = Math.sin(facing);
    let target = null;
    let targetDistance = Infinity;
    let targetKind = 'thug';

    // Preman adalah sasaran utama; bila tak ada, peluru mengenai pejalan terdekat dalam kerucut.
    for (const thug of state.thugs) {
      if (thug.down) continue;
      const dx = thug.x - player.x;
      const dy = thug.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= SHOT_RANGE && distance > 0 && distance < targetDistance
        && (dx * facingX + dy * facingY) / distance >= SHOT_CONE_COSINE) {
        target = thug;
        targetDistance = distance;
      }
    }

    if (!target) {
      targetKind = 'ped';
      for (const ped of peds) {
        if (ped.down) continue;
        const dx = ped.x - player.x;
        const dy = ped.y - player.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= SHOT_RANGE && distance > 0 && distance < targetDistance
          && (dx * facingX + dy * facingY) / distance >= SHOT_CONE_COSINE) {
          target = ped;
          targetDistance = distance;
        }
      }
    }

    const flashDistance = target ? targetDistance : SHOT_RANGE;
    state.lastShot = {
      x1: player.x,
      y1: player.y,
      x2: player.x + facingX * flashDistance,
      y2: player.y + facingY * flashDistance,
      until: state.elapsed + SHOT_FLASH_DURATION,
    };
    addHeat(SHOT_CRIME_HEAT);

    let events = EVENT_SHOT;
    if (target && targetKind === 'thug') {
      target.hp = Math.max(0, target.hp - 1);
      if (target.hp <= 0) {
        target.down = true;
        target.state = 'down';
        target.speed = 0;
        target.contactTime = 0;
      }
    } else if (target) {
      target.down = true;
      target.state = 'down';
      target.angle = facing;
      target.speed = 0;
      target.panic = 0;
      addHeat(SHOT_PED_CRIME_HEAT);
      events |= EVENT_PED_DOWN;
    }

    for (const ped of peds) {
      if (!ped.down && Math.hypot(ped.x - player.x, ped.y - player.y) <= SHOT_PANIC_RADIUS) {
        triggerPedPanic(ped, player, pedestrianNetwork);
      }
    }
    return events;
  }

  function pursuerPosition(cop) {
    return cop.officer ?? cop;
  }

  function crimeWasWitnessed(x, y) {
    for (const ped of peds) {
      if (!ped.down && Math.hypot(ped.x - x, ped.y - y) <= WITNESS_DISTANCE) return true;
    }
    for (const cop of state.cops) {
      const pursuer = pursuerPosition(cop);
      if (Math.hypot(pursuer.x - x, pursuer.y - y) <= WITNESS_DISTANCE) return true;
    }
    return false;
  }

  function enterNearestCar() {
    let nearest = null;
    let nearestDistance = 40;
    for (const car of cars) {
      if (car.driver !== null) continue;
      const distance = Math.hypot(car.x - player.x, car.y - player.y);
      if (distance < nearestDistance) {
        nearest = car;
        nearestDistance = distance;
      }
    }
    if (nearest) {
      const witnessed = crimeWasWitnessed(nearest.x, nearest.y);
      player.car = nearest;
      nearest.driver = 'player';
      player.x = nearest.x;
      player.y = nearest.y;
      if (witnessed && !nearest.stolen) addHeat(CAR_THEFT_HEAT);
      nearest.stolen = true;
    }
  }

  function exitCar() {
    const car = player.car;
    if (!car) return;
    const distance = car.type.width / 2 + player.radius + 6;
    const rightX = car.x - Math.sin(car.angle) * distance;
    const rightY = car.y + Math.cos(car.angle) * distance;
    const leftX = car.x + Math.sin(car.angle) * distance;
    const leftY = car.y - Math.cos(car.angle) * distance;
    if (positionIsFree(rightX, rightY, player.radius)) {
      player.x = rightX;
      player.y = rightY;
    } else {
      player.x = leftX;
      player.y = leftY;
    }
    car.driver = null;
    car.speed = 0;
    player.car = null;
  }

  function registerCarCrash(car, x, y, hitCar, impactSpeed) {
    const damage = 4 + Math.max(0, impactSpeed - 60) * 0.055;
    car.hp = Math.max(0, car.hp - damage);
    carCrashes.push({ x, y });

    if (hitCar) {
      hitCar.hp = Math.max(0, hitCar.hp - damage * 0.65);
      hitCar.speed = 0;
      hitCar.trafficPause = TRAFFIC_HIT_PAUSE;
    }

    if (car === player.car && hitCar && impactSpeed >= FAST_CRASH_CRIME_SPEED) {
      addHeat(HARD_CAR_CRIME_HEAT);
    }

    // Hantaman pelan hanya menghentikan kendaraan; hantaman keras beruntun berakibat WASTED.
    if (impactSpeed >= HARD_CRASH_SPEED
      && player.car && (car === player.car || hitCar === player.car)) {
      damagePlayer(12 + (impactSpeed - HARD_CRASH_SPEED) * 0.11);
    }
  }

  function driveCar(car, inputX, inputY, dt) {
    const type = car.type;
    if (inputY < 0) {
      car.speed = Math.min(type.maxSpeed, car.speed - inputY * type.acceleration * dt);
    } else if (inputY > 0) {
      const braking = inputY * type.acceleration * dt;
      if (car.speed > 0) car.speed = Math.max(0, car.speed - braking * 1.8);
      else car.speed = Math.max(-type.maxSpeed * 0.45, car.speed - braking * 0.7);
    } else if (car.speed !== 0) {
      const friction = Math.min(Math.abs(car.speed), type.acceleration * 0.45 * dt);
      car.speed -= Math.sign(car.speed) * friction;
    }

    if (car.speed !== 0) {
      const impactSpeed = Math.abs(car.speed);
      const nextAngle = car.angle + inputX * 2.4 * (car.speed / type.maxSpeed) * dt;
      const nextX = car.x + Math.cos(nextAngle) * car.speed * dt;
      const nextY = car.y + Math.sin(nextAngle) * car.speed * dt;
      const hitCar = cars.find((other) => other !== car
        && carsOverlap(nextX, nextY, nextAngle, type, other));
      if (!hitCar && carPositionIsFree(nextX, nextY, nextAngle, type)) {
        car.x = nextX;
        car.y = nextY;
        car.angle = nextAngle;
      } else {
        car.speed = 0;
        registerCarCrash(car, nextX, nextY, hitCar, impactSpeed);
      }
    }
    player.x = car.x;
    player.y = car.y;
  }

  function trafficPathBlocked(car) {
    const vector = TRAFFIC_DIRECTIONS[car.trafficDirection];
    const forwardX = vector.x;
    const forwardY = vector.y;
    const sideX = -forwardY;
    const sideY = forwardX;
    const speedMargin = car.speed * 0.5;

    for (const other of cars) {
      if (other === car) continue;
      const offsetX = other.x - car.x;
      const offsetY = other.y - car.y;
      const ahead = offsetX * forwardX + offsetY * forwardY;
      if (ahead <= 0) continue;
      const side = Math.abs(offsetX * sideX + offsetY * sideY);
      const otherCosine = Math.cos(other.angle);
      const otherSine = Math.sin(other.angle);
      const otherForwardRadius = other.type.length / 2
        * Math.abs(otherCosine * forwardX + otherSine * forwardY)
        + other.type.width / 2 * Math.abs(-otherSine * forwardX + otherCosine * forwardY);
      const otherSideRadius = other.type.length / 2
        * Math.abs(otherCosine * sideX + otherSine * sideY)
        + other.type.width / 2 * Math.abs(-otherSine * sideX + otherCosine * sideY);
      if (ahead - otherForwardRadius < car.type.length / 2 + 28 + speedMargin
        && side < car.type.width / 2 + otherSideRadius + 8) return true;
    }

    if (!player.car) {
      const offsetX = player.x - car.x;
      const offsetY = player.y - car.y;
      const ahead = offsetX * forwardX + offsetY * forwardY;
      const side = Math.abs(offsetX * sideX + offsetY * sideY);
      if (ahead > 0 && ahead < car.type.length / 2 + player.radius + 32 + speedMargin
        && side < car.type.width / 2 + player.radius + 8) return true;
    }
    return false;
  }

  function turnAtIntersection(car) {
    const direction = car.trafficDirection;
    const choices = [(direction + 3) % 4, direction, (direction + 1) % 4]
      .filter((candidate) => {
        const vector = TRAFFIC_DIRECTIONS[candidate];
        const nextX = car.x + vector.x * ROAD.spacing;
        const nextY = car.y + vector.y * ROAD.spacing;
        return nextX > 0 && nextX <= LAST_ROAD_X && nextY > 0 && nextY <= LAST_ROAD_Y;
      });
    car.trafficDirection = choices[Math.floor(random() * choices.length)];
    car.angle = car.trafficDirection * Math.PI / 2;
    car.trafficTarget = nextTrafficIntersection(car.x, car.y, car.trafficDirection);
  }

  function updateTraffic(dt) {
    for (const car of cars) {
      if (!car.traffic || car.police || car.driver === 'player' || player.car === car) continue;
      if (car.trafficPause > 0) {
        car.trafficPause = Math.max(0, car.trafficPause - dt);
        car.speed = 0;
        continue;
      }
      if (trafficPathBlocked(car)) {
        car.speed = 0;
        continue;
      }

      car.speed = Math.min(TRAFFIC_SPEED, car.speed + car.type.acceleration * dt);
      const vector = TRAFFIC_DIRECTIONS[car.trafficDirection];
      const distanceToIntersection = (car.trafficTarget.x - car.x) * vector.x
        + (car.trafficTarget.y - car.y) * vector.y;
      if (car.speed * dt >= distanceToIntersection) {
        car.x = car.trafficTarget.x;
        car.y = car.trafficTarget.y;
        turnAtIntersection(car);
      } else {
        car.x += vector.x * car.speed * dt;
        car.y += vector.y * car.speed * dt;
      }
    }
  }

  function updatePeds(dt) {
    let pedDown = false;

    for (const ped of peds) {
      if (ped.down) continue;
      for (const car of cars) {
        if (Math.abs(car.speed) <= 1 || !carTouchesPed(car, ped)) continue;
        ped.down = true;
        ped.state = 'down';
        ped.angle = car.angle;
        ped.speed = 0;
        ped.panic = 0;
        if (car.driver === 'player') addHeat(PED_DOWN_CRIME_HEAT);
        carCrashes.push({ x: ped.x, y: ped.y });
        pedDown = true;
        break;
      }
    }

    for (const ped of peds) {
      if (ped.down) continue;
      let danger = null;
      let nearestDistance = PED_PANIC_RADIUS;
      for (const car of cars) {
        if (Math.abs(car.speed) < PED_FAST_CAR_SPEED) continue;
        const distance = Math.hypot(car.x - ped.x, car.y - ped.y);
        if (distance <= nearestDistance) {
          danger = car;
          nearestDistance = distance;
        }
      }
      for (const crash of carCrashes) {
        const distance = Math.hypot(crash.x - ped.x, crash.y - ped.y);
        if (distance <= nearestDistance) {
          danger = crash;
          nearestDistance = distance;
        }
      }
      if (danger) triggerPedPanic(ped, danger, pedestrianNetwork);
      advancePed(ped, pedestrianNetwork, random, dt);
    }
    return pedDown;
  }

  function updateThugs(dt) {
    for (const thug of state.thugs) {
      if (thug.down) continue;
      const dx = player.x - thug.x;
      const dy = player.y - thug.y;
      const distance = Math.hypot(dx, dy);
      if (distance > THUG_SIGHT_DISTANCE) {
        thug.state = 'idle';
        thug.contactTime = 0;
        continue;
      }

      thug.state = 'chase';
      if (distance <= 0) {
        thug.contactTime = 0;
        continue;
      }
      thug.angle = Math.atan2(dy, dx);
      if (distance < THUG_HIT_DISTANCE) {
        // Timer kontak menjaga total luka enam HP per detik, bukan per frame.
        thug.contactTime += dt;
        player.hp = Math.max(0, player.hp - THUG_DAMAGE_PER_SECOND * dt);
        continue;
      }

      thug.contactTime = 0;
      const movement = Math.min(distance, THUG_SPEED * dt);
      const moveX = dx / distance * movement;
      const moveY = dy / distance * movement;
      if (positionIsFree(thug.x + moveX, thug.y, thug.radius)) thug.x += moveX;
      if (positionIsFree(thug.x, thug.y + moveY, thug.radius)) thug.y += moveY;
    }
  }

  function nearestRoadCenter(value, maximum) {
    return clamp(Math.round(value / ROAD.spacing) * ROAD.spacing, 0, maximum);
  }

  function spawnPoliceCar() {
    const candidates = [];
    for (let x = 0; x <= LAST_ROAD_X; x += ROAD.spacing) {
      for (let y = 0; y <= LAST_ROAD_Y; y += ROAD.spacing) {
        const distance = Math.hypot(x - player.x, y - player.y);
        if (distance >= POLICE_SPAWN_MIN_DISTANCE && distance <= POLICE_SPAWN_MAX_DISTANCE) {
          candidates.push({ x, y });
        }
      }
    }

    // Acak titik awal pencarian agar beberapa patroli tidak menumpuk di simpang yang sama.
    const start = candidates.length ? Math.floor(random() * candidates.length) : 0;
    for (let index = 0; index < candidates.length; index += 1) {
      const spot = candidates[(start + index) % candidates.length];
      const angle = random() < 0.5 ? 0 : Math.PI / 2;
      if (!carPositionIsFree(spot.x, spot.y, angle, POLICE_CAR_TYPE)) continue;
      const blocked = cars.some((car) => carsOverlap(
        spot.x, spot.y, angle, POLICE_CAR_TYPE, car,
      ));
      if (blocked) continue;

      const cop = {
        x: spot.x,
        y: spot.y,
        angle,
        type: POLICE_CAR_TYPE,
        kind: 'polisi',
        police: true,
        color: POLICE_CAR_TYPE.colors[0],
        speed: 0,
        hp: 140,
        driver: 'police',
        traffic: false,
        trafficDirection: Math.round(angle / (Math.PI / 2)) % 4,
        trafficTarget: null,
        trafficPause: 0,
        officer: null,
        onFoot: false,
        turnBias: state.cops.length % 2 === 0 ? 1 : -1,
      };
      cars.push(cop);
      state.cops.push(cop);
      return cop;
    }
    return null;
  }

  function removeCop(cop) {
    const copIndex = state.cops.indexOf(cop);
    if (copIndex >= 0) state.cops.splice(copIndex, 1);
    const carIndex = cars.indexOf(cop);
    if (carIndex >= 0) cars.splice(carIndex, 1);
  }

  function syncPoliceCount() {
    while (state.cops.length < state.wanted) {
      if (!spawnPoliceCar()) break;
    }
    while (state.cops.length > state.wanted) {
      removeCop(state.cops[state.cops.length - 1]);
    }
  }

  function policeWaypoint(cop) {
    const verticalX = nearestRoadCenter(cop.x, LAST_ROAD_X);
    const horizontalY = nearestRoadCenter(cop.y, LAST_ROAD_Y);
    const playerVerticalX = nearestRoadCenter(player.x, LAST_ROAD_X);
    const playerHorizontalY = nearestRoadCenter(player.y, LAST_ROAD_Y);
    const nearVertical = Math.abs(cop.x - verticalX) <= ROAD_HALF * 0.52;
    const nearHorizontal = Math.abs(cop.y - horizontalY) <= ROAD_HALF * 0.52;
    const playerNearVertical = Math.abs(player.x - playerVerticalX) <= ROAD_HALF;
    const playerNearHorizontal = Math.abs(player.y - playerHorizontalY) <= ROAD_HALF;

    // Begitu satu ruas jalan mempertemukan buron dan polisi, kejar langsung di ruas itu.
    if (playerNearVertical && Math.abs(cop.x - playerVerticalX) <= ROAD_HALF * 0.48) {
      return { x: playerVerticalX, y: player.y };
    }
    if (playerNearHorizontal && Math.abs(cop.y - playerHorizontalY) <= ROAD_HALF * 0.48) {
      return { x: player.x, y: playerHorizontalY };
    }

    // Selain itu tempuh satu sumbu dahulu: mobil tidak memotong blok untuk mengejar.
    const headingVertical = Math.abs(Math.sin(cop.angle)) >= Math.abs(Math.cos(cop.angle));
    if (nearVertical && (!nearHorizontal || headingVertical)) {
      return { x: verticalX, y: playerHorizontalY };
    }
    if (nearHorizontal) return { x: playerVerticalX, y: horizontalY };
    return { x: verticalX, y: horizontalY };
  }

  function deployOfficer(cop) {
    if (cop.officer) return;
    const side = cop.turnBias * (cop.type.width / 2 + 9);
    const sideX = cop.x - Math.sin(cop.angle) * side;
    const sideY = cop.y + Math.cos(cop.angle) * side;
    const officer = {
      x: positionIsFree(sideX, sideY, 10) ? sideX : cop.x,
      y: positionIsFree(sideX, sideY, 10) ? sideY : cop.y,
      angle: cop.angle,
      radius: 10,
      speed: POLICE_FOOT_SPEED,
      color: PALETTE.police,
    };
    cop.speed = 0;
    cop.officer = officer;
    cop.onFoot = true;
  }

  function updateOfficer(cop, dt) {
    const officer = cop.officer;
    const dx = player.x - officer.x;
    const dy = player.y - officer.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001) return;
    officer.angle = Math.atan2(dy, dx);
    const movement = Math.min(distance, POLICE_FOOT_SPEED * dt);
    const moveX = dx / distance * movement;
    const moveY = dy / distance * movement;
    if (positionIsFree(officer.x + moveX, officer.y, officer.radius)) officer.x += moveX;
    if (positionIsFree(officer.x, officer.y + moveY, officer.radius)) officer.y += moveY;
  }

  function updatePoliceCar(cop, dt) {
    if (cop.officer) {
      updateOfficer(cop, dt);
      return;
    }

    const playerDistance = Math.hypot(cop.x - player.x, cop.y - player.y);
    // Pusat mobil bisa tertahan bodi/pemarkir sebelum jarak lama tercapai. Ukur ambang
    // turun dari tepi kendaraan agar polisi berhenti lalu mengejar pemain diam dengan kaki.
    const exitDistance = POLICE_EXIT_DISTANCE + cop.type.length / 2 + player.radius;
    if (!player.car && playerDistance <= exitDistance) {
      deployOfficer(cop);
      updateOfficer(cop, dt);
      return;
    }

    const target = policeWaypoint(cop);
    const desiredAngle = Math.atan2(target.y - cop.y, target.x - cop.x);
    const difference = normalizeAngle(desiredAngle - cop.angle);
    const turn = clamp(difference, -3.1 * dt, 3.1 * dt);
    const nextAngle = cop.angle + turn;
    const turnSlowdown = Math.abs(difference) > 0.8 ? 0.4 : 1;
    const targetSpeed = POLICE.speed * turnSlowdown;
    const speedChange = POLICE_CAR_ACCELERATION * dt * turnSlowdown;
    if (cop.speed < targetSpeed) cop.speed = Math.min(targetSpeed, cop.speed + speedChange);
    else cop.speed = Math.max(targetSpeed, cop.speed - speedChange * 1.5);

    const nextX = cop.x + Math.cos(nextAngle) * cop.speed * dt;
    const nextY = cop.y + Math.sin(nextAngle) * cop.speed * dt;
    const hitCar = cars.find((other) => other !== cop
      && carsOverlap(nextX, nextY, nextAngle, cop.type, other));
    if (!hitCar && carPositionIsFree(nextX, nextY, nextAngle, cop.type)) {
      cop.x = nextX;
      cop.y = nextY;
      cop.angle = nextAngle;
    } else {
      const impactSpeed = Math.abs(cop.speed);
      cop.speed = 0;
      registerCarCrash(cop, nextX, nextY, hitCar, impactSpeed);
      // Pada tikungan yang terlalu sempit, bias tetap membantu patroli mencoba sisi lain.
      if (!hitCar) cop.angle += cop.turnBias * Math.min(0.12, Math.abs(difference) * 0.1);
    }
  }

  function updateBusted(dt) {
    const reachable = !player.car || Math.abs(player.car.speed) <= BUSTED_SLOW_SPEED;
    let caught = false;
    if (reachable) {
      for (const cop of state.cops) {
        const pursuer = pursuerPosition(cop);
        if (Math.hypot(pursuer.x - player.x, pursuer.y - player.y) <= POLICE.catchDistance) {
          caught = true;
          break;
        }
      }
    }

    if (caught && !state.busted && !state.wasted) {
      state.bustedMeter = clamp(state.bustedMeter + dt / BUSTED_SECONDS, 0, 1);
    } else {
      state.bustedMeter = clamp(state.bustedMeter - dt / (BUSTED_SECONDS * 0.65), 0, 1);
    }
    if (state.bustedMeter >= 1 && !state.wasted) state.busted = true;
  }

  function updateWanted(dt) {
    state.wantedFlash = Math.max(0, state.wantedFlash - dt);
    let seen = false;
    for (const cop of state.cops) {
      const pursuer = pursuerPosition(cop);
      if (Math.hypot(pursuer.x - player.x, pursuer.y - player.y) <= POLICE_SIGHT_DISTANCE) {
        seen = true;
        break;
      }
    }
    state.policeSeeing = seen;
    if (seen || state.wantedHeat <= 0) state.unseenFor = 0;
    else state.unseenFor += dt;

    if (state.unseenFor >= HEAT_DECAY_DELAY && state.wantedHeat > 0) {
      state.wantedHeat = Math.max(0, state.wantedHeat - HEAT_DECAY_RATE * dt);
      syncWanted();
    }
  }

  function updatePlayerCarHits() {
    if (player.car) return;
    for (const car of cars) {
      const speed = Math.abs(car.speed);
      if (speed < PED_FAST_CAR_SPEED || !carTouchesPed(car, player)) continue;
      if (state.crashDamageCooldown <= 0) {
        damagePlayer(8 + Math.max(0, speed - PED_FAST_CAR_SPEED) * 0.09);
        carCrashes.push({ x: player.x, y: player.y });
      }
      break;
    }
  }

  function followPlayer() {
    camera.x = clamp(player.x - camera.width / 2, 0, Math.max(0, WORLD.width - camera.width));
    camera.y = clamp(player.y - camera.height / 2, 0, Math.max(0, WORLD.height - camera.height));
  }

  function reset() {
    if (player.car) {
      player.car.driver = null;
      player.car.speed = 0;
      player.car = null;
    }
    for (let index = cars.length - 1; index >= 0; index -= 1) {
      if (cars[index].police) cars.splice(index, 1);
    }
    state.cops.length = 0;
    state.thugs.length = 0;
    state.lastShot = null;
    player.x = spawn.x;
    player.y = spawn.y;
    player.hp = PLAYER.hp;
    player.money = 0;
    player.gun = false;
    player.facing = 0;
    state.wantedHeat = 0;
    state.wanted = 0;
    state.wantedFlash = 0;
    state.crimeHeat = 0;
    state.policeSeeing = false;
    state.unseenFor = 0;
    state.bustedMeter = 0;
    state.busted = false;
    state.wasted = false;
    state.crashDamageCooldown = 0;
    state.elapsed = 0;
    followPlayer();
  }

  // Kontrol adalah vektor {x, y}; vektor diagonal dinormalkan sebelum dikali kecepatan.
  function step(dt, control = STATIONARY) {
    if (player.hp <= 0) state.wasted = true;
    if (state.busted || state.wasted) {
      return (state.busted ? EVENT_BUSTED : EVENT_NONE)
        | (state.wasted ? EVENT_WASTED : EVENT_NONE);
    }

    let events = EVENT_NONE;
    state.elapsed += dt;
    state.crashDamageCooldown = Math.max(0, state.crashDamageCooldown - dt);
    carCrashes.length = 0;
    // wanted selalu merupakan turunan heat, termasuk saat heat diatur oleh adegan/pengujian.
    syncWanted();

    let inputX = Number.isFinite(control.x) ? control.x : 0;
    let inputY = Number.isFinite(control.y) ? control.y : 0;
    const magnitude = Math.hypot(inputX, inputY);
    if (magnitude > 1) {
      inputX /= magnitude;
      inputY /= magnitude;
    }

    if (!player.car && (inputX !== 0 || inputY !== 0)) {
      player.facing = Math.atan2(inputY, inputX);
    }

    let exitedCar = false;
    if (control.interact) {
      if (player.car) {
        exitCar();
        exitedCar = true;
      } else {
        enterNearestCar();
      }
    }

    if (player.car) {
      driveCar(player.car, inputX, inputY, dt);
    } else if (!exitedCar) {
      // Uji kedua sumbu bergantian. Sumbu yang bebas tetap bergerak saat sumbu lain terhalang,
      // sehingga pemain meluncur mengikuti dinding alih-alih berhenti serentak.
      const moveX = inputX * PLAYER.speed * dt;
      const moveY = inputY * PLAYER.speed * dt;
      if (moveX !== 0 && positionIsFree(player.x + moveX, player.y, player.radius)) player.x += moveX;
      if (moveY !== 0 && positionIsFree(player.x, player.y + moveY, player.radius)) player.y += moveY;
    }

    if (!player.car && player.gun && control.fire) events |= fireGun();

    updateTraffic(dt);
    updateThugs(dt);
    if (updatePeds(dt)) events |= EVENT_PED_DOWN;
    updatePlayerCarHits();
    syncPoliceCount();
    for (const cop of state.cops) updatePoliceCar(cop, dt);
    updateBusted(dt);
    updateWanted(dt);

    if (player.hp <= 0) {
      state.wasted = true;
      state.busted = false;
      state.bustedMeter = 0;
    }
    if (state.busted) events |= EVENT_BUSTED;
    if (state.wasted) events |= EVENT_WASTED;
    followPlayer();
    return events;
  }

  reset();
  return { state, reset, spawnThug, step };
}
