let sharedAudioContext = null;

const getAudioContextClass = () => {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
};

export const getSharedAudioContext = () => {
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) return null;

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextClass();
  }

  return sharedAudioContext;
};

export const unlockSharedAudioContext = async () => {
  const audioContext = getSharedAudioContext();
  if (!audioContext) return null;

  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      return audioContext;
    }
  }

  return audioContext;
};
