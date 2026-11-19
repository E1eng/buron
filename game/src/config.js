// Semua angka dan warna BURON nongkrong di sini. Dunianya besar; layar cuma jendela kecil
// buat ngintip Kota Tanjung, jadi jangan gantungkan aturan main ke ukuran monitor.

export const WORLD = { width: 4800, height: 3600 };

/** Jarak antar-pusat jalan, lebar aspal, dan trotoar di tiap sisinya (semua satuan dunia). */
export const ROAD = { spacing: 480, width: 120, sidewalk: 18 };

/** Area logis yang digambar; renderer boleh membesar-kecilkannya sesuka hati. */
export const VIEW = { width: 1280, height: 720 };

/** Satu langkah simulasi dalam detik: tetap 60 Hz walau layarnya lagi ngambek. */
export const STEP = 1 / 60;

/** Raka kalau lagi jalan kaki: cukup cepat buat kabur, tetap butuh nyawa buat nekat. */
export const PLAYER = { radius: 14, speed: 235, hp: 100 };

// Kendaraan curian maupun pinjaman. Panjang dan lebar mengikuti satuan dunia;
// maxSpeed dalam unit/detik, acceleration dalam unit/detik kuadrat.
export const CAR = {
  types: [
    {
      name: 'Hatchback Kampung',
      length: 78,
      width: 40,
      maxSpeed: 390,
      acceleration: 205,
      colors: ['#d7c6a1', '#59776f', '#a6533f'],
    },
    {
      name: 'Sedan Kelabang',
      length: 94,
      width: 44,
      maxSpeed: 455,
      acceleration: 225,
      colors: ['#31343b', '#77515a', '#b0a798'],
    },
    {
      name: 'Dock Pickup',
      length: 106,
      width: 48,
      maxSpeed: 370,
      acceleration: 175,
      colors: ['#49666b', '#a66a42', '#c2b280'],
    },
    {
      name: 'Van Mama Rosa',
      length: 116,
      width: 52,
      maxSpeed: 335,
      acceleration: 150,
      colors: ['#6b5144', '#3f4c56', '#c9b99a'],
    },
  ],
};

/** Polisi patroli: bukan yang tercepat di kota, tapi jangan biarkan terlalu dekat. */
export const POLICE = { speed: 285, catchDistance: 48 };

/** Indeks ambang + 1 adalah bintang buron; poin datang dari segala ulah kriminal. */
export const WANTED = {
  maxStars: 5,
  thresholds: [100, 250, 450, 700, 1000],
};

/** Senja di pelabuhan: semen hangat, atap berdebu, laut gelap, neon warung menyala. */
export const PALETTE = {
  sky: '#493747',
  sunset: '#d88761',
  asphalt: '#24262b',
  roadLine: '#c7ad73',
  sidewalk: '#ad987c',
  roofs: ['#736252', '#8b5c48', '#a8674d', '#66534a', '#b07958'],
  sea: '#164b52',
  dockSand: '#c0a070',
  warungNeon: '#ffd84a',
  player: '#efd3a1',
  police: '#79a9d1',
  ink: '#202127',
  text: '#f4ead8',
  muted: '#b6a99c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Satu slot simpanan peramban; jangan sampai catatan Mama Rosa nyasar ke game lain. */
export const SAVE_KEY = 'buron.save';
