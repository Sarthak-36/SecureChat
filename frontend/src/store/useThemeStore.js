import { create } from "zustand";

import { THEMES } from "../constants";

const availableThemeNames = new Set(THEMES.map((themeOption) => themeOption.name));
const storedTheme = localStorage.getItem("securechat-theme");
const defaultTheme = availableThemeNames.has(storedTheme) ? storedTheme : "business";

export const useThemeStore = create((set) => ({
  theme: defaultTheme,
  setTheme: (theme) => {
    localStorage.setItem("securechat-theme", theme);
    set({ theme });
  },
}));
