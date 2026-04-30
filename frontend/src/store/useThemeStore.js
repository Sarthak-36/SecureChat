import { create } from "zustand";

export const useThemeStore = create((set) => ({
  theme: localStorage.getItem("securechat-theme") || "coffee",
  setTheme: (theme) => {
    localStorage.setItem("securechat-theme", theme);
    set({ theme });
  },
}));
