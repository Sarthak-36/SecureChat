import { useCallback, useEffect, useRef } from "react";

import { getSharedAudioContext, unlockSharedAudioContext } from "../lib/audio";

const playTone = (audioContext, frequency, durationMs, delayMs = 0) => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const startTime = audioContext.currentTime + delayMs / 1000;
  const endTime = startTime + durationMs / 1000;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.linearRampToValueAtTime(0.06, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime);
};

const useRingtone = (isActive) => {
  const intervalRef = useRef(null);
  const isDisposedRef = useRef(false);

  const stopRingtone = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isActive || typeof window === "undefined") return undefined;

    isDisposedRef.current = false;
    const audioContext = getSharedAudioContext();
    if (!audioContext) return undefined;

    const ring = async () => {
      if (audioContext.state === "suspended") {
        const unlockedContext = await unlockSharedAudioContext();
        if (!unlockedContext || unlockedContext.state === "suspended") {
          return;
        }
      }

      if (isDisposedRef.current) return;

      playTone(audioContext, 784, 220, 0);
      playTone(audioContext, 988, 220, 280);
    };

    ring();
    intervalRef.current = window.setInterval(ring, 1800);

    return () => {
      isDisposedRef.current = true;
      stopRingtone();
    };
  }, [isActive, stopRingtone]);

  return { stopRingtone };
};

export default useRingtone;
