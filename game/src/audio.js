// Efek suara BURON dibuat seluruhnya dengan WebAudio. AudioContext sengaja tidak
// dibuat ketika modul dimuat: browser hanya mengizinkannya setelah gestur pemain.
export let muted = false;

let context = null;
let masterGain = null;
let engineOscillator = null;
let engineGain = null;
let nextSirenAt = 0;
let sirenHigh = false;

function ensureContext() {
  if (context) return context;
  if (typeof window === 'undefined') return null;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (typeof Context !== 'function') return null;

  try {
    context = new Context();
    masterGain = context.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(context.destination);
  } catch {
    context = null;
    masterGain = null;
  }
  return context;
}

function unlock() {
  const ctx = ensureContext();
  if (!ctx || ctx.state !== 'suspended' || typeof ctx.resume !== 'function') return;
  try {
    const resumed = ctx.resume();
    if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {});
  } catch {
    // Interaksi berikutnya dapat mencoba resume lagi.
  }
}

function connectWithGain(node, gain) {
  node.connect(gain);
  gain.connect(masterGain || context.destination);
}

function cleanOnEnded(source, ...nodes) {
  source.onended = () => {
    for (const node of [source, ...nodes]) {
      try { node.disconnect(); } catch { /* Node mungkin sudah terlepas. */ }
    }
  };
}

function tone(frequency, start, duration, volume = 0.035, endFrequency = null, type = 'sine') {
  if (!context || muted) return;
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const end = start + duration;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== null) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, end);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, Math.min(start + 0.015, end));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    connectWithGain(oscillator, gain);
    cleanOnEnded(oscillator, gain);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  } catch {
    // Audio tidak boleh mengganggu simulasi jika perangkat menolak node baru.
  }
}

export function toggleMute() {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 1;
  if (muted) engineStop();
  return muted;
}

export function engineStart() {
  if (!context || muted || engineOscillator) return;
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 42;
    gain.gain.value = 0.025;
    connectWithGain(oscillator, gain);
    oscillator.start();
    engineOscillator = oscillator;
    engineGain = gain;
  } catch {
    engineOscillator = null;
    engineGain = null;
  }
}

export function engineStop() {
  if (!engineOscillator) return;
  const oscillator = engineOscillator;
  const gain = engineGain;
  engineOscillator = null;
  engineGain = null;
  try { oscillator.stop(); } catch { /* Osilator boleh sudah berhenti. */ }
  for (const node of [oscillator, gain]) {
    try { node?.disconnect(); } catch { /* Tidak ada yang perlu dilakukan. */ }
  }
}

export function enginePitch(rpm) {
  if (!context || muted || !engineOscillator) return;
  const safeRpm = Number.isFinite(rpm) ? Math.max(0, Math.min(8000, rpm)) : 0;
  const frequency = 42 + (safeRpm / 8000) * 78;
  try {
    engineOscillator.frequency.setTargetAtTime(frequency, context.currentTime, 0.06);
  } catch {
    engineOscillator.frequency.value = frequency;
  }
}

export function sirenTick(wanted) {
  if (!context || muted) return;
  if (!(wanted > 0)) {
    nextSirenAt = 0;
    return;
  }
  const now = context.currentTime;
  if (now < nextSirenAt) return;
  tone(sirenHigh ? 740 : 520, now, 0.28, 0.022, null, 'square');
  sirenHigh = !sirenHigh;
  nextSirenAt = now + 0.36;
}

export function shot() {
  if (!context || muted) return;
  try {
    const duration = 0.075;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    const now = context.currentTime;
    source.buffer = buffer;
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    connectWithGain(source, gain);
    cleanOnEnded(source, gain);
    source.start(now);
    source.stop(now + duration);
  } catch {
    // Tembakan tetap tercatat oleh dunia walau audio tidak tersedia.
  }
}

export function cash() {
  if (!context || muted) return;
  const now = context.currentTime;
  tone(523.25, now, 0.18, 0.045);
  tone(783.99, now + 0.14, 0.28, 0.05);
}

export function busted() {
  if (!context || muted) return;
  tone(260, context.currentTime, 0.75, 0.055, 55, 'sawtooth');
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('click', unlock);
  window.addEventListener('keydown', (event) => {
    unlock();
    if (!event.repeat && (event.code === 'KeyM' || event.key === 'm' || event.key === 'M')) {
      toggleMute();
    }
  });
}
