let audioContext = null;
let orderAudioPrimed = false;
const audioCache = new Map();

const KITCHEN_ORDER_AUDIO_URL = `${import.meta.env.BASE_URL}audio/cozinha.mpeg`;
const CASH_ORDER_AUDIO_URL = `${import.meta.env.BASE_URL}audio/dinheiro.mpeg`;

const TONES = {
  "new-order": {
    type: "triangle",
    from: 784,
    to: 1046,
    duration: 0.45,
    gain: 0.08,
  },
  overdue: {
    type: "sawtooth",
    from: 523,
    to: 659,
    duration: 0.55,
    gain: 0.06,
  },
  reconnected: {
    type: "sine",
    from: 660,
    to: 880,
    duration: 0.35,
    gain: 0.05,
  },
};

export function playKitchenAlertTone(tone = "new-order") {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const selectedTone = TONES[tone] ?? TONES["new-order"];

    if (!AudioContextClass) {
      return;
    }

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = selectedTone.type;
    oscillator.frequency.setValueAtTime(selectedTone.from, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      selectedTone.to,
      now + selectedTone.duration * 0.4,
    );

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(selectedTone.gain, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      now + selectedTone.duration,
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + selectedTone.duration + 0.03);
  } catch {
    // Ignore audio playback failures caused by browser policies.
  }
}

function getAudio(audioUrl) {
  if (typeof Audio === "undefined") {
    return null;
  }

  if (!audioCache.has(audioUrl)) {
    const audio = new Audio(audioUrl);
    audio.preload = "auto";
    audio.playsInline = true;
    audioCache.set(audioUrl, audio);
  }

  return audioCache.get(audioUrl);
}

function primeAudio(audioUrl) {
  const audio = getAudio(audioUrl);
  if (!audio) {
    return;
  }

  audio.muted = true;
  audio.volume = 0;

  const playPromise = audio.play();
  if (playPromise?.then) {
    playPromise
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        audio.volume = 1;
      })
      .catch(() => {});
  }
}

export function primeKitchenOrderAudio() {
  if (orderAudioPrimed) return;

  try {
    primeAudio(KITCHEN_ORDER_AUDIO_URL);
    primeAudio(CASH_ORDER_AUDIO_URL);
    orderAudioPrimed = true;
  } catch {
    // Browser audio policies can block priming; the real play call has fallback.
  }
}

export function installKitchenOrderAudioUnlock() {
  if (typeof window === "undefined") {
    return () => {};
  }

  const unlock = () => primeKitchenOrderAudio();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
  window.addEventListener("click", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });

  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("click", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

export function playKitchenOrderAudio() {
  playAudioFile(KITCHEN_ORDER_AUDIO_URL, "new-order");
}

export function playCashOrderAudio() {
  playAudioFile(CASH_ORDER_AUDIO_URL, "new-order");
}

function playAudioFile(audioUrl, fallbackTone = "new-order") {
  try {
    const audio = getAudio(audioUrl);

    if (!audio) {
      playKitchenAlertTone(fallbackTone);
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    audio.volume = 1;

    const playPromise = audio.play();
    if (playPromise?.catch) {
      playPromise.catch(() => playKitchenAlertTone(fallbackTone));
    }
  } catch {
    playKitchenAlertTone(fallbackTone);
  }
}
