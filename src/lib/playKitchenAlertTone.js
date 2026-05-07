let audioContext = null;

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
