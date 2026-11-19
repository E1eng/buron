// Rantai kerja sampingan Mama Rosa. Modul ini hanya mengatur misi; tabrakan, kendaraan,
// dan uang dasar tetap milik dunia. Semua waktu memakai detik simulasi agar mudah diuji.
import { CAR, WANTED } from './config.js';
import { EVENT_BUSTED, EVENT_WASTED, EVENT_NONE } from './world.js';

const ROSA_RADIUS = 60;
const DELIVERY_RADIUS = 64;
const GARAGE_RADIUS = 76;
const CASH_RADIUS = 48;
const WAREHOUSE_RADIUS = 48;
const WAREHOUSE_HOLD_SECONDS = 3;
const RETRY_DELAY = 2.5;
const DIALOG_SECONDS = 7;
const RESULT_SECONDS = 5;

const MISSIONS = [
  {
    name: 'First Run',
    limit: 90,
    reward: 250,
    dialog: "Raka, got a package for one of my guys at the far end of East Dock. Don't open it, don't stop for anything. Ninety seconds is plenty, right?",
    thanks: 'Nice, the package made it in one piece. Here, for gas and coffee. Keep it between us, yeah?',
  },
  {
    name: 'Hot Goods',
    limit: 120,
    reward: 400,
    dialog: "See the sports car I marked? Get it to the garage in Old Market. It's not exactly ours, so don't be shocked if the cops crash the party.",
    thanks: "Now that's a beauty. I'll stash the car right away. Take a breather—the cops will be chasing their own tails.",
  },
  {
    name: 'Night Deposit',
    limit: 150,
    reward: 250,
    dialog: "There are still three collection bags to pick up. Grab them one by one, follow the markers. I'll pay you fifty bucks a bag, right on the spot.",
    thanks: "That's every last bag. Knew I could count on you, Raka. Here, a little bonus from Mama.",
  },
  {
    name: 'Bad Debt',
    limit: 240,
    reward: 500,
    dialog: "Got a deadbeat in the warehouse by the docks, with two thugs guarding him. Drop them or hold the warehouse marker for three seconds to collect what's ours. Here, take this gun.",
    thanks: "That's the debt sorted. You've got guts and I can count on you, Raka. Here's your cut.",
  },
  {
    name: 'Harbor Heat',
    limit: 180,
    reward: 750,
    dialog: 'Raka, this is the last shipment. Grab the van I marked at the harbor, then run it up to Northside. The cops will be all over you, but stay cool—just get the goods there.',
    thanks: "Last shipment's safe. Our work here is done. Now we just need a way out of Tanjung for good.",
  },
  {
    name: 'Last Ferry',
    limit: 180,
    reward: 0,
    dialog: "This is our ticket out. The last ferry's waiting at the far end of East Dock. You've got three minutes, and every cop in town will be on your tail—stay cool and keep your foot down. After this, we're gone for good.",
    thanks: "Ferry's pulling out. So long, Tanjung.",
  },
];

function getState(world) {
  return world?.state ?? world;
}

function distance(player, destination) {
  return Math.hypot(player.x - destination.x, player.y - destination.y);
}

function point(x, y, label) {
  return { x, y, label };
}

function isSport(car) {
  return car.type?.kind === 'sport' || /sport/i.test(car.type?.name ?? '');
}

function wantedStars(heat) {
  let stars = 0;
  for (let index = 0; index < WANTED.thresholds.length; index += 1) {
    if (heat >= WANTED.thresholds[index]) stars = index + 1;
  }
  return Math.min(stars, WANTED.maxStars);
}

export function createMissions() {
  const state = {
    index: 0,
    phase: 'offer',
    timer: 0,
    banner: { title: '', text: '', until: 0 },
    objective: null,
    complete: false,
    ending: false,
  };

  let retryIn = 0;
  let targetCar = null;
  let targetStolen = false;
  let cashIndex = 0;
  let cashPoints = [];
  let warehouseTarget = null;
  let warehouseHold = 0;
  let debtThugs = [];

  function showBanner(title, text, seconds = RESULT_SECONDS) {
    state.banner = { title, text, until: seconds };
  }

  function dockPoint(worldState) {
    const docks = worldState.docks ?? [];
    // Semua dermaga menghadap ke timur; pakai ujung terjauh dari garis pantai.
    const dock = docks[0];
    if (dock) return point(dock.x + dock.width - 42, dock.y + dock.height / 2, 'East Dock');
    return point(worldState.water?.x ?? 4300, 480, 'East Dock');
  }

  function ferryPoint(worldState) {
    const docks = worldState.docks ?? [];
    let ferryDock = docks[0];
    for (const dock of docks) {
      if (dock.x + dock.width > (ferryDock?.x ?? -Infinity) + (ferryDock?.width ?? 0)) {
        ferryDock = dock;
      }
    }
    if (ferryDock) {
      return point(
        ferryDock.x + ferryDock.width - 42,
        ferryDock.y + ferryDock.height / 2,
        'Last Ferry · East Dock End',
      );
    }
    return point((worldState.water?.x ?? 4300) + 428, 480, 'Last Ferry · East Dock End');
  }

  function cargoPickupPoint(worldState) {
    const dock = worldState.docks?.[1] ?? worldState.docks?.[0];
    if (dock) return point(dock.x - 150, dock.y + dock.height / 2, 'Cargo Van · Harbor');
    return point((worldState.water?.x ?? 4080) - 150, 1920, 'Cargo Van · Harbor');
  }

  function cargoDeliveryPoint() {
    return point(2400, 480, 'Cargo Drop · Northside');
  }

  function garagePoint(worldState) {
    const market = worldState.market;
    if (market) {
      return point(market.x + market.width / 2, market.y + market.height / 2, 'Old Market Garage');
    }
    return point(1440, 1920, 'Old Market Garage');
  }

  function warehousePoint(worldState) {
    const dock = worldState.docks?.[1] ?? worldState.docks?.[0];
    if (dock) return point(dock.x - 70, dock.y + dock.height / 2, 'Dock Warehouse');
    return point((worldState.water?.x ?? 4080) - 100, 1920, 'Dock Warehouse');
  }

  function makeCashPoints(worldState) {
    const market = worldState.market;
    const left = market?.x ?? 960;
    const top = market?.y ?? 960;
    const middleX = left + (market?.width ?? 960) / 2;
    const middleY = top + (market?.height ?? 1920) / 2;
    const dock = worldState.docks?.[1];
    return [
      point(left, middleY, 'Cash Bag 1/3 · Old Market'),
      point(middleX, top, 'Cash Bag 2/3 · Market Street'),
      dock
        ? point(dock.x + dock.width * 0.62, dock.y + dock.height / 2, 'Cash Bag 3/3 · Docks')
        : point(middleX + 480, middleY + 480, 'Cash Bag 3/3 · Docks'),
    ];
  }

  function selectSportCar(worldState) {
    const cars = worldState.cars ?? [];
    const parked = cars.filter((car) => !car.police && !car.traffic && car.driver === null);
    let selected = parked.find((car) => isSport(car) && !car.stolen)
      ?? parked.find((car) => isSport(car));

    // Seed atau dunia buatan pengujian bisa belum punya sport. Pinjam satu mobil kosong
    // dan pasang spesifikasinya supaya misi tidak pernah buntu.
    if (!selected) selected = parked.find((car) => !car.stolen) ?? parked[0];
    if (!selected) {
      selected = cars.find((car) => car.missionTarget && !car.police && isSport(car)) ?? null;
    }

    if (selected && !isSport(selected)) {
      const sport = CAR.types.find((type) => type.kind === 'sport' || /sport/i.test(type.name));
      if (sport) selected.type = sport;
    }
    for (const car of cars) car.missionTarget = car === selected;
    return selected;
  }

  function isInHarbor(car, worldState) {
    return (worldState.docks ?? []).some((dock) => (
      car.x >= dock.x - 650
      && car.x <= dock.x + dock.width
      && Math.abs(car.y - (dock.y + dock.height / 2)) <= 330
    ));
  }

  function selectCargoCar(worldState) {
    const cars = worldState.cars ?? [];
    const parked = cars.filter((car) => !car.police && !car.traffic
      && (car.driver === null || car.driver === 'npc'));
    let largestSize = -1;
    for (const car of parked) {
      const size = (car.type?.length ?? 0) * (car.type?.width ?? 0);
      if (size > largestSize) largestSize = size;
    }

    const largest = parked.filter((car) => (
      (car.type?.length ?? 0) * (car.type?.width ?? 0) === largestSize
    ));
    let selected = largest.find((car) => isInHarbor(car, worldState)) ?? largest[0] ?? null;
    if (!selected) selected = cars.find((car) => car.missionTarget && !car.police) ?? null;

    if (selected) {
      selected.driver = null;
      selected.speed = 0;
      // Jika mobil terbesar tidak parkir di tepi laut, pindahkan mobil yang sama
      // ke pelabuhan agar setiap seed tetap punya kargo yang dapat diambil.
      if (!isInHarbor(selected, worldState)) {
        const pickup = cargoPickupPoint(worldState);
        selected.x = pickup.x;
        selected.y = pickup.y;
        selected.angle = 0;
      }
    }
    for (const car of cars) car.missionTarget = car === selected;
    return selected;
  }

  function clearDebtThugs(worldState) {
    for (const thug of debtThugs) {
      const index = worldState.thugs?.indexOf(thug) ?? -1;
      if (index >= 0) worldState.thugs.splice(index, 1);
    }
    debtThugs = [];
  }

  function startNext(world) {
    const worldState = getState(world);
    if (!worldState || state.complete) return;
    const mission = MISSIONS[state.index];
    if (!mission) {
      state.phase = 'done';
      state.complete = true;
      state.objective = null;
      return;
    }

    state.phase = 'offer';
    state.timer = 0;
    state.objective = point(
      worldState.places?.rosa?.x ?? worldState.warung?.x ?? worldState.player.x,
      worldState.places?.rosa?.y ?? worldState.warung?.y ?? worldState.player.y,
      'Meet Mama Rosa',
    );
    retryIn = 0;
    targetStolen = false;
    cashIndex = 0;
    warehouseHold = 0;
    warehouseTarget = null;
    clearDebtThugs(worldState);

    if (state.index === 1) {
      targetCar = selectSportCar(worldState);
    } else if (state.index === 4) {
      targetCar = selectCargoCar(worldState);
    } else {
      targetCar = null;
      for (const car of worldState.cars ?? []) car.missionTarget = false;
      if (state.index === 2) cashPoints = makeCashPoints(worldState);
    }
  }

  function activate(world) {
    const worldState = getState(world);
    const mission = MISSIONS[state.index];
    state.phase = 'active';
    state.timer = mission.limit;
    showBanner(`Mama Rosa · ${mission.name}`, mission.dialog, DIALOG_SECONDS);

    if (state.index === 0) {
      state.objective = dockPoint(worldState);
    } else if (state.index === 1) {
      if (!targetCar) targetCar = selectSportCar(worldState);
      state.objective = targetCar
        ? point(targetCar.x, targetCar.y, 'Steal the sports car')
        : garagePoint(worldState);
    } else if (state.index === 2) {
      cashIndex = 0;
      cashPoints = makeCashPoints(worldState);
      state.objective = cashPoints[0];
    } else if (state.index === 3) {
      warehouseHold = 0;
      warehouseTarget = warehousePoint(worldState);
      clearDebtThugs(worldState);
      if (typeof world?.spawnThug === 'function') {
        debtThugs = [
          world.spawnThug(warehouseTarget.x - 42, warehouseTarget.y - 48),
          world.spawnThug(warehouseTarget.x + 36, warehouseTarget.y + 52),
        ];
      }
      worldState.player.gun = true;
      state.objective = point(
        warehouseTarget.x,
        warehouseTarget.y,
        'Dock Warehouse · 0/2 thugs down · Hold 0.0/3s',
      );
    } else if (state.index === 4) {
      if (!targetCar) targetCar = selectCargoCar(worldState);
      state.objective = targetCar
        ? point(targetCar.x, targetCar.y, 'Get in the cargo van · Harbor')
        : cargoPickupPoint(worldState);
    } else if (state.index === 5) {
      state.objective = ferryPoint(worldState);
    }

    // Wanted berlaku sejak briefing dimulai, bukan baru pada tick berikutnya.
    if (state.index === 4) forceWanted(worldState, 4);
    else if (state.index === 5) forceWanted(worldState, 5);
  }

  function fail(reason) {
    state.phase = 'failed';
    state.timer = 0;
    state.objective = null;
    retryIn = RETRY_DELAY;
    const problem = reason === 'busted'
      ? 'Damn, you got busted.'
      : reason === 'wasted'
        ? 'Raka, they messed you up bad.'
        : 'You ran out of time.';
    showBanner('MISSION FAILED', `${problem} Meet Mama Rosa again when you're ready for another shot.`);
    // Pencurian pada percobaan berikutnya boleh menaikkan wanted lagi.
    targetStolen = false;
  }

  function completeCurrent(worldState) {
    const mission = MISSIONS[state.index];
    worldState.player.money = (worldState.player.money ?? 0) + mission.reward;
    state.timer = 0;
    showBanner(`MISSION COMPLETE + $${mission.reward}`, `Mama Rosa: ${mission.thanks}`);

    if (targetCar) targetCar.missionTarget = false;
    if (state.index === MISSIONS.length - 1) {
      state.phase = 'done';
      state.complete = true;
      state.objective = null;
      targetCar = null;
      return;
    }

    state.index += 1;
    startNext(worldState);
  }

  function finishStory(worldState) {
    state.timer = 0;
    state.phase = 'done';
    state.complete = true;
    state.ending = true;
    state.objective = null;
    showBanner(
      'THE END',
      'Raka took the last ferry out of Tanjung and left the city — and every warrant with his name on it — behind. This time, he is gone for good.',
      8,
    );
    for (const car of worldState.cars ?? []) car.missionTarget = false;
    targetCar = null;
  }

  function raiseWanted(worldState) {
    worldState.wantedHeat = (worldState.wantedHeat ?? 0) + Math.max(100, WANTED.thresholds[0] ?? 100);
    worldState.wanted = wantedStars(worldState.wantedHeat);
    worldState.crimeHeat = worldState.wantedHeat;
    worldState.wantedFlash = 1.35;
    worldState.unseenFor = 0;
  }

  function forceWanted(worldState, stars) {
    const minimumHeat = WANTED.thresholds[stars - 1] ?? 0;
    const heat = Number.isFinite(worldState.wantedHeat) ? worldState.wantedHeat : 0;
    worldState.wantedHeat = Math.max(heat, minimumHeat);
    worldState.wanted = wantedStars(worldState.wantedHeat);
    worldState.crimeHeat = worldState.wantedHeat;
    worldState.wantedFlash = Math.max(worldState.wantedFlash ?? 0, 1.35);
    worldState.unseenFor = 0;
  }

  function updateDelivery(worldState) {
    if (distance(worldState.player, state.objective) <= DELIVERY_RADIUS) completeCurrent(worldState);
  }

  function updateHotCar(worldState) {
    if (!targetCar) return;
    const drivingTarget = worldState.player.car === targetCar;
    if (drivingTarget && !targetStolen) {
      targetStolen = true;
      raiseWanted(worldState);
    }

    if (!drivingTarget) {
      state.objective = point(
        targetCar.x,
        targetCar.y,
        targetStolen ? 'Get back in the sports car' : 'Steal the sports car',
      );
      return;
    }

    state.objective = garagePoint(worldState);
    if (distance(targetCar, state.objective) <= GARAGE_RADIUS) completeCurrent(worldState);
  }

  function updateCash(worldState) {
    const objective = cashPoints[cashIndex];
    if (!objective || distance(worldState.player, objective) > CASH_RADIUS) return;
    worldState.player.money = (worldState.player.money ?? 0) + 50;
    cashIndex += 1;
    if (cashIndex >= cashPoints.length) {
      completeCurrent(worldState);
      return;
    }
    showBanner(`CASH BAG + $50`, `${cashIndex}/3 secured. Hit the next marker—don't leave any cash behind.`, 3);
    state.objective = cashPoints[cashIndex];
  }

  function updateDebtCollection(worldState, elapsed) {
    if (!warehouseTarget) return;
    const downCount = debtThugs.filter((thug) => thug.down || thug.hp <= 0).length;
    if (debtThugs.length === 2 && downCount === 2) {
      completeCurrent(worldState);
      return;
    }

    const onFoot = !worldState.player.car;
    if (onFoot && distance(worldState.player, warehouseTarget) <= WAREHOUSE_RADIUS) {
      warehouseHold = Math.min(WAREHOUSE_HOLD_SECONDS, warehouseHold + elapsed);
    } else {
      warehouseHold = 0;
    }

    state.objective = point(
      warehouseTarget.x,
      warehouseTarget.y,
      `Dock Warehouse · ${downCount}/2 thugs down · Hold ${warehouseHold.toFixed(1)}/3s`,
    );
    if (warehouseHold + 1e-9 >= WAREHOUSE_HOLD_SECONDS) completeCurrent(worldState);
  }

  function updateCargo(worldState) {
    if (!targetCar) return;
    const drivingTarget = worldState.player.car === targetCar;
    if (!drivingTarget) {
      state.objective = point(
        targetCar.x,
        targetCar.y,
        targetStolen ? 'Get back in the cargo van' : 'Get in the cargo van · Harbor',
      );
      return;
    }

    targetStolen = true;
    state.objective = cargoDeliveryPoint();
    // Kargo hanya sah diantar oleh Raka dengan mobil target yang masih dikemudikannya.
    if (distance(targetCar, state.objective) <= DELIVERY_RADIUS) completeCurrent(worldState);
  }

  function update(dt, world, events = EVENT_NONE) {
    const worldState = getState(world);
    if (!worldState?.player) return;
    const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    state.banner.until = Math.max(0, (state.banner.until ?? 0) - elapsed);

    const busted = Boolean(events & EVENT_BUSTED) || Boolean(worldState.busted);
    const wasted = Boolean(events & EVENT_WASTED) || Boolean(worldState.wasted);
    if (state.phase === 'active' && (busted || wasted)) {
      fail(busted ? 'busted' : 'wasted');
      return;
    }
    if (state.complete || state.phase === 'done') return;

    if (state.phase === 'failed') {
      // Selama layar tertangkap/kalah masih aktif, penawaran ulang menunggu reset dunia.
      if (busted || wasted) return;
      retryIn -= elapsed;
      if (retryIn <= 0) startNext(world);
      return;
    }

    if (state.phase === 'offer') {
      const rosa = worldState.places?.rosa ?? worldState.warung;
      if (rosa && distance(worldState.player, rosa) <= ROSA_RADIUS) activate(world);
      return;
    }
    if (state.phase !== 'active') return;

    if (state.index === 4) forceWanted(worldState, 4);
    else if (state.index === 5) forceWanted(worldState, 5);

    state.timer = Math.max(0, state.timer - elapsed);
    if (state.timer <= 0) {
      fail('timeout');
      return;
    }

    if (state.index === 0) updateDelivery(worldState);
    else if (state.index === 1) updateHotCar(worldState);
    else if (state.index === 2) updateCash(worldState);
    else if (state.index === 3) updateDebtCollection(worldState, elapsed);
    else if (state.index === 4) updateCargo(worldState);
    else if (state.index === 5 && distance(worldState.player, state.objective) <= DELIVERY_RADIUS) {
      finishStory(worldState);
    }
  }

  function reset(world) {
    const worldState = getState(world);
    if (worldState) {
      for (const car of worldState.cars ?? []) car.missionTarget = false;
      clearDebtThugs(worldState);
    }
    state.index = 0;
    state.phase = 'offer';
    state.timer = 0;
    state.banner = { title: '', text: '', until: 0 };
    state.objective = null;
    state.complete = false;
    state.ending = false;
    retryIn = 0;
    targetCar = null;
    targetStolen = false;
    cashIndex = 0;
    cashPoints = [];
    warehouseTarget = null;
    warehouseHold = 0;
    debtThugs = [];
    if (worldState) startNext(worldState);
  }

  return { state, update, startNext, reset };
}
