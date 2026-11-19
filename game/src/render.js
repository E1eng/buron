// Renderer Kota Tanjung: hanya membaca state dunia dan melukis jendela kamera ke kanvas.
// Ukuran logis tetap 1280x720; kamera menentukan bagian dunia yang tampak, sedangkan resize
// hanya mengatur skala dan letterbox. Tidak ada aturan permainan yang hidup di file ini.
import { FONT, PALETTE, PLAYER, VIEW, WANTED, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;
const PANEL = { width: 780, top: 146, line: 34, bottom: 72 };
const CITY_START_MINUTE = 18 * 60;
const MINUTES_PER_DAY = 24 * 60;
const STAR_COUNT = WANTED.maxStars;
const MINIMAP = { width: 190, height: 145, margin: 20, inset: 4 };
const GROUND = '#625a4c';
const DARK_GLASS = '#15242a';

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function rectVisible(rect, camera, margin = 0) {
  return rect.x + rect.width >= camera.x - margin
    && rect.x <= camera.x + camera.width + margin
    && rect.y + rect.height >= camera.y - margin
    && rect.y <= camera.y + camera.height + margin;
}

function pointVisible(x, y, camera, margin = 0) {
  return x >= camera.x - margin && x <= camera.x + camera.width + margin
    && y >= camera.y - margin && y <= camera.y + camera.height + margin;
}

/** Fill only the intersection of a world rectangle and the camera, never the off-screen part. */
function fillVisibleRect(context, rect, camera) {
  const left = Math.max(rect.x, camera.x);
  const top = Math.max(rect.y, camera.y);
  const right = Math.min(rect.x + rect.width, camera.x + camera.width);
  const bottom = Math.min(rect.y + rect.height, camera.y + camera.height);
  if (right > left && bottom > top) context.fillRect(left, top, right - left, bottom - top);
}

/** Satu detik pelarian berjalan sebagai satu menit pada jam kota. */
function cityClock(elapsed) {
  const seconds = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const minuteOfDay = (CITY_START_MINUTE + Math.floor(seconds)) % MINUTES_PER_DAY;
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const moneyLabel = cachedLabel('$ ');
  const clockLabel = cachedLabel('');
  const finalLabel = cachedLabel('Money $ ');
  const bestLabel = cachedLabel('Best $ ');
  const fonts = new Map();
  let facing = -Math.PI / 2;
  let lastPlayerX = NaN;
  let lastPlayerY = NaN;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(window.innerWidth * ratio));
    const height = Math.max(1, Math.round(window.innerHeight * ratio));
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left', weight = 400) {
    const key = `${weight}:${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawGround(state, camera) {
    context.fillStyle = GROUND;
    context.fillRect(camera.x, camera.y, camera.width, camera.height);

    const water = state.water;
    context.fillStyle = PALETTE.sea;
    fillVisibleRect(context, water, camera);

    // Ombak pendek dibuat hanya pada petak laut yang sedang terlihat.
    const left = Math.max(water.x, camera.x);
    const top = Math.max(water.y, camera.y);
    const right = Math.min(water.x + water.width, camera.x + camera.width);
    const bottom = Math.min(water.y + water.height, camera.y + camera.height);
    if (right > left && bottom > top) {
      const drift = (state.elapsed * 9) % 96;
      const firstX = Math.floor((left - drift) / 96) * 96 + drift;
      const firstY = Math.floor(top / 58) * 58;
      context.strokeStyle = 'rgba(164, 207, 199, 0.18)';
      context.lineWidth = 2;
      context.beginPath();
      for (let y = firstY; y < bottom; y += 58) {
        for (let x = firstX; x < right; x += 96) {
          const start = Math.max(left, x);
          const end = Math.min(right, x + 36);
          if (end > start) {
            context.moveTo(start, y);
            context.lineTo(end, y);
          }
        }
      }
      context.stroke();
    }

    context.fillStyle = PALETTE.dockSand;
    for (const dock of state.docks) {
      if (!rectVisible(dock, camera)) continue;
      fillVisibleRect(context, dock, camera);
      const dockLeft = Math.max(dock.x, camera.x);
      const dockRight = Math.min(dock.x + dock.width, camera.x + camera.width);
      const dockBottom = Math.min(dock.y + dock.height, camera.y + camera.height);
      context.strokeStyle = 'rgba(70, 48, 35, 0.42)';
      context.lineWidth = 2;
      context.beginPath();
      const firstPlank = Math.max(dock.y, Math.floor(camera.y / 18) * 18);
      for (let y = firstPlank; y < dockBottom; y += 18) {
        if (y < dock.y) continue;
        context.moveTo(dockLeft, y);
        context.lineTo(dockRight, y);
      }
      context.stroke();
    }
  }

  function drawRoads(state, camera) {
    context.fillStyle = PALETTE.asphalt;
    for (const road of state.roads) fillVisibleRect(context, road, camera);

    context.save();
    context.strokeStyle = PALETTE.roadLine;
    context.lineWidth = 3;
    context.setLineDash([30, 26]);
    context.beginPath();
    for (const road of state.roads) {
      if (!rectVisible(road, camera, 32)) continue;
      if (road.direction === 'vertical') {
        const x = road.x + road.width / 2;
        if (x < camera.x || x > camera.x + camera.width) continue;
        const start = Math.max(road.y, camera.y - 32);
        const end = Math.min(road.y + road.height, camera.y + camera.height + 32);
        context.moveTo(x, start);
        context.lineTo(x, end);
      } else {
        const y = road.y + road.height / 2;
        if (y < camera.y || y > camera.y + camera.height) continue;
        const start = Math.max(road.x, camera.x - 32);
        const end = Math.min(road.x + road.width, camera.x + camera.width + 32);
        context.moveTo(start, y);
        context.lineTo(end, y);
      }
    }
    context.stroke();
    context.restore();

    context.fillStyle = PALETTE.sidewalk;
    for (const sidewalk of state.sidewalks) fillVisibleRect(context, sidewalk, camera);
  }

  function drawBuilding(building) {
    const lift = building.visualHeight ?? 20;
    const roofX = lift * 0.24;
    const roofY = lift * 0.38;
    const { x, y, width, height } = building;

    // Bayangan jatuh serong ke tenggara; atap terangkat sedikit ke arah sebaliknya.
    context.fillStyle = 'rgba(20, 16, 24, 0.3)';
    context.fillRect(x + lift * 0.32 + 5, y + lift * 0.34 + 6, width, height);

    context.fillStyle = building.color;
    context.fillRect(x, y, width, height);
    context.fillStyle = 'rgba(24, 20, 27, 0.48)';
    context.fillRect(x, y, width, height);

    context.beginPath();
    context.moveTo(x + width, y);
    context.lineTo(x + width - roofX, y - roofY);
    context.lineTo(x + width - roofX, y + height - roofY);
    context.lineTo(x + width, y + height);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(x, y + height);
    context.lineTo(x - roofX, y + height - roofY);
    context.lineTo(x + width - roofX, y + height - roofY);
    context.lineTo(x + width, y + height);
    context.closePath();
    context.fill();

    // Warna atap sengaja datang langsung dari state bangunan.
    context.fillStyle = building.color;
    context.fillRect(x - roofX, y - roofY, width, height);
    context.strokeStyle = 'rgba(244, 234, 216, 0.16)';
    context.lineWidth = 2;
    context.strokeRect(x - roofX + 2, y - roofY + 2, width - 4, height - 4);
    context.strokeStyle = 'rgba(32, 33, 39, 0.2)';
    context.beginPath();
    context.moveTo(x - roofX + 10, y - roofY + height * 0.35);
    context.lineTo(x - roofX + width - 10, y - roofY + height * 0.35);
    context.stroke();
  }

  function drawBuildings(state, camera) {
    for (const building of state.buildings) {
      if (rectVisible(building, camera, (building.visualHeight ?? 20) + 16)) drawBuilding(building);
    }
  }

  function drawProp(prop) {
    if (prop.type === 'tree') {
      const radius = prop.radius ?? 14;
      context.fillStyle = 'rgba(20, 18, 24, 0.25)';
      context.beginPath();
      context.ellipse(prop.x + 5, prop.y + 7, radius, radius * 0.72, 0, 0, TAU);
      context.fill();
      context.fillStyle = '#294d3a';
      context.beginPath();
      context.arc(prop.x, prop.y, radius, 0, TAU);
      context.fill();
      context.fillStyle = '#49734b';
      context.beginPath();
      context.arc(prop.x - radius * 0.22, prop.y - radius * 0.25, radius * 0.72, 0, TAU);
      context.fill();
    } else if (prop.type === 'lamp') {
      const pole = (prop.visualHeight ?? 42) * 0.32;
      const lightY = prop.y - pole;
      context.strokeStyle = '#343239';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(prop.x, prop.y);
      context.lineTo(prop.x, lightY);
      context.stroke();
      context.fillStyle = 'rgba(255, 216, 74, 0.14)';
      context.beginPath();
      context.arc(prop.x, lightY, 13, 0, TAU);
      context.fill();
      context.fillStyle = PALETTE.warungNeon;
      context.beginPath();
      context.arc(prop.x, lightY, 4, 0, TAU);
      context.fill();
    } else if (prop.type === 'warung-sign') {
      context.fillStyle = 'rgba(255, 216, 74, 0.16)';
      context.beginPath();
      context.arc(prop.x, prop.y - 14, 28, 0, TAU);
      context.fill();
      context.textBaseline = 'bottom';
      text('MAMA ROSA', prop.x - 3, prop.y - 18, 13, prop.color, 'right', 700);
      context.fillStyle = prop.color;
      context.beginPath();
      context.arc(prop.x, prop.y, 4, 0, TAU);
      context.fill();
    }
  }

  function drawProps(state, camera) {
    for (const prop of state.props) {
      const margin = prop.type === 'warung-sign' ? 100 : (prop.radius ?? 20) + 28;
      if (pointVisible(prop.x, prop.y, camera, margin)) drawProp(prop);
    }
  }

  function drawPed(ped, camera) {
    const radius = ped.radius ?? 6;
    if (!pointVisible(ped.x, ped.y, camera, radius * 2 + 12)) return;

    context.save();
    context.translate(ped.x, ped.y);
    context.rotate(ped.down ? ped.angle : 0);
    context.fillStyle = 'rgba(15, 14, 20, 0.35)';
    context.beginPath();
    if (ped.down) context.ellipse(3, 4, radius * 1.55, radius * 0.72, 0, 0, TAU);
    else context.ellipse(3, 5, radius, radius * 0.7, 0, 0, TAU);
    context.fill();

    context.fillStyle = ped.color ?? PALETTE.sunset;
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = 1.5;
    context.beginPath();
    if (ped.down) context.ellipse(0, 0, radius * 1.55, radius * 0.72, 0, 0, TAU);
    else context.arc(0, 0, radius, 0, 0, TAU);
    context.fill();
    context.stroke();
    context.restore();
  }

  function drawPeds(state, camera) {
    for (const ped of state.peds ?? []) drawPed(ped, camera);
  }

  function drawThugs(state, camera) {
    for (const thug of state.thugs ?? []) {
      const radius = thug.radius ?? 11;
      if (!pointVisible(thug.x, thug.y, camera, radius * 2 + 12)) continue;
      context.save();
      context.translate(thug.x, thug.y);
      context.rotate(thug.down ? (thug.angle ?? 0) : 0);

      context.fillStyle = 'rgba(15, 14, 20, 0.4)';
      context.beginPath();
      if (thug.down) context.ellipse(3, 4, radius * 1.55, radius * 0.72, 0, 0, TAU);
      else context.ellipse(3, 5, radius, radius * 0.72, 0, 0, TAU);
      context.fill();

      context.fillStyle = '#303038';
      context.strokeStyle = PALETTE.ink;
      context.lineWidth = 2;
      context.beginPath();
      if (thug.down) context.ellipse(0, 0, radius * 1.55, radius * 0.72, 0, 0, TAU);
      else context.arc(0, 0, radius, 0, 0, TAU);
      context.fill();
      context.stroke();

      context.fillStyle = '#b94245';
      context.fillRect(-radius + 1, -radius + 3, radius * 2 - 2, 4);
      context.beginPath();
      context.arc(radius - 2, -radius + 5, 2.5, 0, TAU);
      context.fill();
      context.restore();
    }
  }

  function drawShotFlash(state) {
    const shot = state.lastShot;
    if (!shot || !(shot.until > state.elapsed)) return;
    if (![shot.x1, shot.y1, shot.x2, shot.y2].every(Number.isFinite)) return;
    context.save();
    context.lineCap = 'round';
    context.strokeStyle = 'rgba(255, 216, 74, 0.3)';
    context.lineWidth = 9;
    context.beginPath();
    context.moveTo(shot.x1, shot.y1);
    context.lineTo(shot.x2, shot.y2);
    context.stroke();
    context.strokeStyle = PALETTE.text;
    context.lineWidth = 2.5;
    context.stroke();
    context.restore();
  }

  function drawPoliceOfficers(state, camera) {
    for (const cop of state.cops ?? []) {
      const officer = cop.officer;
      if (!officer || !pointVisible(officer.x, officer.y, camera, 24)) continue;
      const radius = officer.radius ?? 10;
      context.save();
      context.translate(officer.x, officer.y);
      context.fillStyle = 'rgba(15, 14, 20, 0.35)';
      context.beginPath();
      context.ellipse(3, 5, radius, radius * 0.72, 0, 0, TAU);
      context.fill();
      context.rotate(officer.angle ?? 0);
      context.fillStyle = PALETTE.police;
      context.strokeStyle = PALETTE.ink;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, radius, 0, TAU);
      context.fill();
      context.stroke();
      context.fillStyle = PALETTE.text;
      context.fillRect(-3, -radius + 2, 6, 4);
      context.strokeStyle = PALETTE.warungNeon;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(radius * 0.25, 0);
      context.lineTo(radius * 1.35, 0);
      context.stroke();
      context.restore();
    }
  }

  function drawCar(car, index, state) {
    const type = car.type;
    const length = type.length;
    const width = type.width;
    const extent = Math.hypot(length, width) / 2 + 30;
    if (!pointVisible(car.x, car.y, state.camera, extent)) return;

    const colors = type.colors;
    const color = car.color ?? (colors && colors.length ? colors[index % colors.length] : PALETTE.player);

    context.save();
    context.translate(car.x + 4, car.y + 7);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(15, 14, 20, 0.35)';
    roundedRect(context, -length / 2, -width / 2, length, width, 9);
    context.fill();
    context.restore();

    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = color;
    roundedRect(context, -length / 2, -width / 2, length, width, 9);
    context.fill();
    context.strokeStyle = 'rgba(15, 16, 20, 0.65)';
    context.lineWidth = 2;
    context.stroke();

    // Hidung mobil mengarah ke sumbu +x lokal, sama seperti arah gerak di world.js.
    context.fillStyle = DARK_GLASS;
    roundedRect(context, length * 0.06, -width * 0.36, length * 0.25, width * 0.72, 4);
    context.fill();
    context.fillStyle = 'rgba(190, 215, 214, 0.2)';
    context.fillRect(length * 0.19, -width * 0.32, 2, width * 0.64);

    context.fillStyle = PALETTE.warungNeon;
    roundedRect(context, length / 2 - 6, -width / 2 + 4, 6, 7, 2);
    context.fill();
    roundedRect(context, length / 2 - 6, width / 2 - 11, 6, 7, 2);
    context.fill();

    if (car.police) {
      context.fillStyle = 'rgba(244, 234, 216, 0.82)';
      context.fillRect(-length * 0.36, -2, length * 0.72, 4);
      const redFlash = Math.floor(state.elapsed * 8) % 2 === 0;
      context.fillStyle = redFlash ? '#ef625c' : '#642f38';
      context.fillRect(-10, -width / 2 - 4, 9, 6);
      context.fillStyle = redFlash ? '#28496e' : '#72b9e8';
      context.fillRect(1, -width / 2 - 4, 9, 6);
    }
    context.restore();

    if (state.player.car === car || car.driver === 'player') {
      const extentY = Math.abs(Math.sin(car.angle)) * length / 2
        + Math.abs(Math.cos(car.angle)) * width / 2;
      const markerY = car.y - extentY - 18;
      context.fillStyle = PALETTE.warungNeon;
      context.strokeStyle = PALETTE.ink;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(car.x, markerY + 10);
      context.lineTo(car.x - 8, markerY - 3);
      context.lineTo(car.x + 8, markerY - 3);
      context.closePath();
      context.fill();
      context.stroke();
    }
  }

  function playerAngle(player) {
    if (Number.isFinite(player.facing)) facing = player.facing;
    else if (Number.isFinite(player.angle)) facing = player.angle;
    else if (Number.isFinite(player.heading)) facing = player.heading;
    else if (Number.isFinite(lastPlayerX) && Math.hypot(player.x - lastPlayerX, player.y - lastPlayerY) > 0.05) {
      facing = Math.atan2(player.y - lastPlayerY, player.x - lastPlayerX);
    }
    lastPlayerX = player.x;
    lastPlayerY = player.y;
    return facing;
  }

  function drawPlayer(player, camera) {
    if (player.car) return;
    const radius = player.radius ?? PLAYER.radius;
    if (!pointVisible(player.x, player.y, camera, radius + 12)) return;
    const angle = playerAngle(player);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);

    context.fillStyle = 'rgba(15, 14, 20, 0.35)';
    context.beginPath();
    context.ellipse(player.x + 4, player.y + 7, radius, radius * 0.72, 0, 0, TAU);
    context.fill();

    context.fillStyle = PALETTE.player;
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(player.x, player.y, radius, 0, TAU);
    context.fill();
    context.stroke();

    context.strokeStyle = PALETTE.ink;
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(player.x + cosine * radius * 0.3, player.y + sine * radius * 0.3);
    context.lineTo(player.x + cosine * radius * 1.5, player.y + sine * radius * 1.5);
    context.stroke();
    context.strokeStyle = PALETTE.warungNeon;
    context.lineWidth = 2;
    context.stroke();
  }

  function drawMissionMarker(state, mission) {
    const objective = mission?.objective;
    if (!objective || !Number.isFinite(objective.x) || !Number.isFinite(objective.y)) return;
    if (!pointVisible(objective.x, objective.y, state.camera, 100)) return;

    const elapsed = Number.isFinite(state.elapsed) ? state.elapsed : 0;
    const pulse = 0.5 + Math.sin(elapsed * 5) * 0.5;
    const radius = 25 + pulse * 9;
    context.save();
    context.fillStyle = 'rgba(255, 216, 74, 0.12)';
    context.strokeStyle = PALETTE.warungNeon;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(objective.x, objective.y, radius, 0, TAU);
    context.fill();
    context.stroke();

    context.globalAlpha = 0.75 - pulse * 0.4;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(objective.x, objective.y, radius + 10 + pulse * 5, 0, TAU);
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.warungNeon;
    context.beginPath();
    context.moveTo(objective.x, objective.y - 7);
    context.lineTo(objective.x + 7, objective.y);
    context.lineTo(objective.x, objective.y + 7);
    context.lineTo(objective.x - 7, objective.y);
    context.closePath();
    context.fill();

    if (objective.label) {
      context.textBaseline = 'bottom';
      text(objective.label, objective.x, objective.y - radius - 15, 15, PALETTE.warungNeon, 'center', 700);
    }
    context.restore();
  }

  function drawWorld(state, mission) {
    const camera = state.camera;
    context.save();
    context.scale(VIEW.width / camera.width, VIEW.height / camera.height);
    context.translate(-camera.x, -camera.y);
    drawGround(state, camera);
    drawRoads(state, camera);
    drawBuildings(state, camera);
    drawProps(state, camera);
    drawPeds(state, camera);
    drawThugs(state, camera);
    for (let index = 0; index < state.cars.length; index += 1) drawCar(state.cars[index], index, state);
    drawPoliceOfficers(state, camera);
    drawPlayer(state.player, camera);
    drawShotFlash(state);
    drawMissionMarker(state, mission);
    context.restore();
  }

  function drawAtmosphere() {
    const sunset = context.createLinearGradient(0, 0, VIEW.width, VIEW.height);
    sunset.addColorStop(0, 'rgba(216, 135, 97, 0.13)');
    sunset.addColorStop(0.48, 'rgba(174, 95, 102, 0.07)');
    sunset.addColorStop(1, 'rgba(73, 55, 91, 0.17)');
    context.fillStyle = sunset;
    context.fillRect(0, 0, VIEW.width, VIEW.height);

    const vignette = context.createRadialGradient(
      VIEW.width / 2, VIEW.height * 0.46, VIEW.height * 0.24,
      VIEW.width / 2, VIEW.height * 0.46, VIEW.width * 0.68,
    );
    vignette.addColorStop(0, 'rgba(20, 15, 28, 0)');
    vignette.addColorStop(0.72, 'rgba(20, 15, 28, 0.035)');
    vignette.addColorStop(1, 'rgba(20, 15, 28, 0.28)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function starPath(x, y, radius) {
    context.beginPath();
    for (let point = 0; point < 10; point += 1) {
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const distance = point % 2 === 0 ? radius : radius * 0.45;
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance;
      if (point === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
  }

  function drawMissionIndicator(state, mission) {
    const objective = mission?.objective;
    if (!objective || !Number.isFinite(objective.x) || !Number.isFinite(objective.y)) return;
    const camera = state.camera;
    if (pointVisible(objective.x, objective.y, camera)) return;

    const targetX = (objective.x - camera.x) * VIEW.width / camera.width;
    const targetY = (objective.y - camera.y) * VIEW.height / camera.height;
    const centerX = VIEW.width / 2;
    const centerY = VIEW.height / 2;
    const dx = targetX - centerX;
    const dy = targetY - centerY;
    const margin = 44;
    const scale = Math.min(
      Math.abs(dx) > 0.001 ? (centerX - margin) / Math.abs(dx) : Infinity,
      Math.abs(dy) > 0.001 ? (centerY - margin) / Math.abs(dy) : Infinity,
    );
    if (!Number.isFinite(scale)) return;
    const x = centerX + dx * scale;
    const y = centerY + dy * scale;
    const angle = Math.atan2(dy, dx);

    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = 'rgba(24, 22, 29, 0.82)';
    context.beginPath();
    context.arc(0, 0, 25, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.warungNeon;
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(25, 0);
    context.lineTo(-10, -13);
    context.lineTo(-5, 0);
    context.lineTo(-10, 13);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();

    if (objective.label) {
      context.textBaseline = 'top';
      text(
        objective.label,
        clamp(x, 150, VIEW.width - 150),
        clamp(y + 34, 8, VIEW.height - 24),
        14,
        PALETTE.warungNeon,
        'center',
        700,
      );
    }
  }

  function missionBannerLines(value, width) {
    const words = String(value ?? '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    context.font = `400 20px ${FONT}`;
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawMissionBanner(mission) {
    const banner = mission?.banner;
    if (!banner || !(banner.until > 0) || !banner.text) return;
    const width = 900;
    const padding = 26;
    const lines = missionBannerLines(banner.text, width - padding * 2);
    if (!lines.length) return;
    const height = 64 + lines.length * 28;
    const x = (VIEW.width - width) / 2;
    const y = VIEW.height - height - 22;

    context.save();
    context.globalAlpha = clamp(banner.until / 0.3, 0, 1);
    context.fillStyle = 'rgba(24, 22, 29, 0.86)';
    roundedRect(context, x, y, width, height, 12);
    context.fill();
    context.strokeStyle = 'rgba(255, 216, 74, 0.55)';
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = PALETTE.warungNeon;
    roundedRect(context, x, y + 14, 4, height - 28, 2);
    context.fill();
    context.textBaseline = 'top';
    text(banner.title || 'Mama Rosa', x + padding, y + 15, 16, PALETTE.warungNeon, 'left', 700);
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], x + padding, y + 48 + index * 28, 20, PALETTE.text);
    }
    context.restore();
  }

  function drawHud(state) {
    const player = state.player;
    const rawWanted = state.wanted ?? 0;
    const wanted = Number.isFinite(rawWanted) ? clamp(Math.floor(rawWanted), 0, STAR_COUNT) : 0;

    context.fillStyle = 'rgba(24, 22, 29, 0.64)';
    roundedRect(context, 16, 14, 224, 78, 10);
    context.fill();
    context.textBaseline = 'top';
    text(moneyLabel(player.money ?? 0), 28, 22, 25, PALETTE.text, 'left', 700);
    text(clockLabel(cityClock(state.elapsed)), 28, 57, 16, PALETTE.muted);

    context.fillStyle = 'rgba(24, 22, 29, 0.64)';
    roundedRect(context, VIEW.width - 202, 14, 186, 62, 10);
    context.fill();
    text('WANTED', VIEW.width - 28, 21, 12, PALETTE.muted, 'right', 700);
    const firstStar = VIEW.width - 28 - (STAR_COUNT - 1) * 30;
    for (let index = 0; index < STAR_COUNT; index += 1) {
      starPath(firstStar + index * 30, 57, 10);
      context.fillStyle = index < wanted ? PALETTE.warungNeon : 'rgba(244, 234, 216, 0.17)';
      context.fill();
    }
  }

  function drawMinimap(state, mission) {
    const panelX = VIEW.width - MINIMAP.width - MINIMAP.margin;
    const panelY = VIEW.height - MINIMAP.height - MINIMAP.margin;
    const x = panelX + MINIMAP.inset;
    const y = panelY + MINIMAP.inset;
    const width = MINIMAP.width - MINIMAP.inset * 2;
    const height = MINIMAP.height - MINIMAP.inset * 2;
    const scaleX = width / WORLD.width;
    const scaleY = height / WORLD.height;

    function dot(entity, color, radius) {
      if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) return;
      const dotX = clamp(x + entity.x * scaleX, x + radius, x + width - radius);
      const dotY = clamp(y + entity.y * scaleY, y + radius, y + height - radius);
      context.fillStyle = color;
      context.beginPath();
      context.arc(dotX, dotY, radius, 0, TAU);
      context.fill();
    }

    context.save();
    context.fillStyle = 'rgba(18, 22, 27, 0.92)';
    roundedRect(context, panelX, panelY, MINIMAP.width, MINIMAP.height, 6);
    context.fill();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();

    context.fillStyle = '#292b2e';
    context.fillRect(x, y, width, height);

    const water = state.water;
    if (water) {
      context.fillStyle = '#123746';
      context.fillRect(
        x + water.x * scaleX,
        y + water.y * scaleY,
        water.width * scaleX,
        water.height * scaleY,
      );
    }

    context.fillStyle = 'rgba(190, 177, 155, 0.3)';
    for (const building of state.buildings ?? []) {
      context.fillRect(
        x + building.x * scaleX,
        y + building.y * scaleY,
        building.width * scaleX,
        building.height * scaleY,
      );
    }

    context.strokeStyle = 'rgba(192, 160, 112, 0.8)';
    context.lineWidth = 1.5;
    context.beginPath();
    for (const dock of state.docks ?? []) {
      const dockX = x + dock.x * scaleX;
      const dockY = y + (dock.y + dock.height / 2) * scaleY;
      context.moveTo(dockX, dockY);
      context.lineTo(dockX + dock.width * scaleX, dockY);
    }
    context.stroke();

    dot(state.warung ?? state.places?.rosa, '#f39a4a', 2.8);
    dot(mission?.objective, PALETTE.warungNeon, 3.1);

    if (state.wanted > 0) {
      const redFlash = Math.floor((state.elapsed ?? 0) * 6) % 2 === 0;
      const policeColor = redFlash ? '#ff6268' : '#68b9ff';
      for (const cop of state.cops ?? []) dot(cop.officer ?? cop, policeColor, 2.5);
    }

    dot(state.player, 'rgba(15, 20, 25, 0.9)', 4.2);
    dot(state.player, '#ffffff', 2.8);
    context.restore();

    context.save();
    context.fillStyle = 'rgba(18, 22, 27, 0.78)';
    context.fillRect(panelX + 7, panelY + 7, 58, 15);
    context.textBaseline = 'top';
    text('TANJUNG', panelX + 11, panelY + 9, 10, PALETTE.text, 'left', 700);
    context.strokeStyle = 'rgba(244, 234, 216, 0.48)';
    context.lineWidth = 1;
    roundedRect(context, panelX + 0.5, panelY + 0.5, MINIMAP.width - 1, MINIMAP.height - 1, 6);
    context.stroke();
    context.restore();
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(28, 25, 34, 0.93)';
    roundedRect(context, x, y, PANEL.width, height, 16);
    context.fill();
    context.strokeStyle = 'rgba(216, 135, 97, 0.4)';
    context.lineWidth = 2;
    context.stroke();

    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 88, title === 'BURON' ? 72 : 48, PALETTE.text, 'center', 800);
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 38, 22, PALETTE.warungNeon, 'center', 700);
  }

  const TITLE_LINES = [
    'Raka is back in Tanjung, the dusk port city that never forgets its fugitive.',
    '',
  ];
  const PAUSED_LINES = ['Tanjung can wait. Catch your breath, then get back on the run.'];
  const OVER_LINES = ['Raka got busted in Tanjung.', '', ''];
  const ENDING_LINES = ['Raka hopped a ferry out of Tanjung and disappeared for good.', '', ''];

  /** Satu frame: dunia dan suasana, lalu HUD atau panel sesuai layar aktif. */
  function draw(state, screen, best, mission, overKind = null, hasSave = false) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.ink;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.save();
    context.beginPath();
    context.rect(0, 0, VIEW.width, VIEW.height);
    context.clip();
    drawWorld(state, screen === SCREEN_TITLE ? null : mission);
    drawAtmosphere();

    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(24, 20, 30, 0.28)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      TITLE_LINES[1] = bestLabel(best ?? 0);
      drawPanel(
        'BURON',
        TITLE_LINES,
        hasSave ? 'Enter: Continue · N: New Game' : 'Enter: Start',
      );
    } else {
      drawMissionIndicator(state, mission);
      drawHud(state);
      if (screen === SCREEN_PLAY) drawMinimap(state, mission);
      drawMissionBanner(mission);
      if (screen === SCREEN_PAUSED) drawPanel('PAUSED', PAUSED_LINES, 'Press P to resume');
      else if (screen === SCREEN_OVER) {
        if (overKind === 'ending' || mission?.ending === true) {
          ENDING_LINES[1] = finalLabel(state.player.money ?? 0);
          ENDING_LINES[2] = bestLabel(best ?? 0);
          drawPanel('THE END', ENDING_LINES, 'Press Space to play again');
        } else {
          OVER_LINES[0] = overKind === 'wasted'
            ? 'Raka got taken down in Tanjung.'
            : 'Raka got busted in Tanjung.';
          OVER_LINES[1] = finalLabel(state.player.money ?? 0);
          OVER_LINES[2] = bestLabel(best ?? 0);
          const title = overKind === 'wasted'
            ? 'WASTED'
            : overKind === 'busted' ? 'BUSTED' : "RUN'S OVER";
          drawPanel(title, OVER_LINES, 'Press Space or click to run it back');
        }
      }
    }
    context.restore();
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
