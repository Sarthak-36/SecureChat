import { useEffect } from "react";

import { unlockSharedAudioContext } from "../lib/audio";

const useAudioUnlock = () => {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let isDisposed = false;

    const tryUnlock = async () => {
      if (isDisposed) return;
      await unlockSharedAudioContext();
    };

    window.addEventListener("pointerdown", tryUnlock, { passive: true });
    window.addEventListener("keydown", tryUnlock);
    window.addEventListener("touchstart", tryUnlock, { passive: true });

    return () => {
      isDisposed = true;
      window.removeEventListener("pointerdown", tryUnlock);
      window.removeEventListener("keydown", tryUnlock);
      window.removeEventListener("touchstart", tryUnlock);
    };
  }, []);
};

export default useAudioUnlock;
