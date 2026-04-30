import { PaletteIcon } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";
import { THEMES } from "../constants";
import ToggleDropdown from "./ToggleDropdown";

const ThemeSelector = () => {
  const { theme, setTheme } = useThemeStore();

  return (
    <ToggleDropdown
      align="right"
      contentClassName="w-56 max-h-80 overflow-y-auto rounded-2xl border border-base-content/10 bg-base-200 p-1 shadow-2xl backdrop-blur-lg"
      renderTrigger={({ toggle }) => (
        <button type="button" className="btn btn-ghost btn-circle" onClick={toggle}>
          <PaletteIcon className="size-5" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="space-y-1">
          <p className="px-4 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-50">
            3 Light · 3 Dark
          </p>
          {THEMES.map((themeOption) => (
            <button
              key={themeOption.name}
              type="button"
              className={`
              w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors
              ${
                theme === themeOption.name
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-base-content/5"
              }
            `}
              onClick={() => {
                setTheme(themeOption.name);
                close();
              }}
            >
              <PaletteIcon className="size-4" />
              <span className="text-sm font-medium">{themeOption.label}</span>
              {/* THEME PREVIEW COLORS */}
              <div className="ml-auto flex gap-1">
                {themeOption.colors.map((color, i) => (
                  <span
                    key={i}
                    className="size-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </ToggleDropdown>
  );
};
export default ThemeSelector;
