import { Link, useLocation } from "react-router";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import {
  BellIcon,
  ChevronRightIcon,
  LogOutIcon,
  PaletteIcon,
  SettingsIcon,
  ShipWheelIcon,
} from "lucide-react";
import { useRef, useState } from "react";

import AvatarImage from "./AvatarImage";
import ToggleDropdown from "./ToggleDropdown";
import { THEMES } from "../constants";
import useAuthUser from "../hooks/useAuthUser";
import useLogout from "../hooks/useLogout";
import useUnreadNotificationCount from "../hooks/useUnreadNotificationCount";
import { useThemeStore } from "../store/useThemeStore";

const Navbar = () => {
  const { authUser } = useAuthUser();
  const { logoutMutation } = useLogout();
  const unreadNotificationCount = useUnreadNotificationCount();
  const { theme, setTheme } = useThemeStore();
  const location = useLocation();
  const isChatPage = location.pathname?.startsWith("/chat");
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isThemeMenuPinned, setIsThemeMenuPinned] = useState(false);
  const themeCloseTimeoutRef = useRef(null);
  const activeTheme = THEMES.find((themeOption) => themeOption.name === theme) || THEMES[0];
  const { refs: themeRefs, floatingStyles: themeStyles } = useFloating({
    open: isThemeMenuOpen,
    onOpenChange: setIsThemeMenuOpen,
    placement: "left-start",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const clearThemeCloseTimeout = () => {
    if (themeCloseTimeoutRef.current) {
      clearTimeout(themeCloseTimeoutRef.current);
      themeCloseTimeoutRef.current = null;
    }
  };

  const openThemeMenu = () => {
    clearThemeCloseTimeout();
    setIsThemeMenuOpen(true);
  };

  const scheduleThemeMenuClose = () => {
    clearThemeCloseTimeout();

    if (isThemeMenuPinned) return;

    themeCloseTimeoutRef.current = setTimeout(() => {
      setIsThemeMenuOpen(false);
    }, 120);
  };

  return (
    <nav className="sticky top-0 z-30 h-16 border-b border-base-300 bg-base-200">
      <div className="container mx-auto flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className={`items-center gap-2.5 ${isChatPage ? "flex" : "flex lg:hidden"}`}
        >
          <ShipWheelIcon className="size-8 text-primary" />
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text font-mono text-xl font-bold tracking-wide text-transparent sm:text-2xl">
            SecureChat
          </span>
        </Link>
        {!isChatPage ? <div className="hidden lg:block" /> : null}

        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/notifications" className="hidden sm:inline-flex">
            <button
              className="btn btn-ghost btn-circle relative"
              title="Notifications"
              aria-label="Notifications"
            >
              <BellIcon className="h-5 w-5 opacity-70" />
              {unreadNotificationCount > 0 ? (
                <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-error px-1 text-[10px] font-bold leading-4 text-error-content">
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              ) : null}
            </button>
          </Link>

          <ToggleDropdown
            align="right"
            contentClassName="w-64 max-w-[calc(100vw-1rem)] rounded-2xl border border-base-content/10 bg-base-100 p-2 shadow-2xl backdrop-blur"
            renderTrigger={({ isOpen, toggle }) => (
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full transition-colors hover:bg-base-content/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
                onClick={() => {
                  if (!isOpen) {
                    setIsThemeMenuOpen(false);
                    setIsThemeMenuPinned(false);
                  }
                  toggle();
                }}
                title="Account menu"
                aria-label="Account menu"
              >
                <span className="avatar">
                <span className="w-9 rounded-full">
                  <AvatarImage
                    src={authUser?.profilePic}
                    name={authUser?.fullName}
                    alt="User Avatar"
                    className="h-full w-full object-cover"
                  />
                </span>
                </span>
              </button>
            )}
          >
            {({ close }) => (
              <div className="relative space-y-2">
                <div className="flex items-center gap-3 rounded-xl bg-base-200 px-3 py-3">
                  <div className="avatar shrink-0">
                    <div className="w-10 rounded-full">
                      <AvatarImage
                        src={authUser?.profilePic}
                        name={authUser?.fullName}
                        alt="User Avatar"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{authUser?.fullName || "Account"}</p>
                    <p className="truncate text-xs opacity-65">{authUser?.email || "Online"}</p>
                  </div>
                </div>

                <Link
                  to="/settings"
                  className="btn btn-ghost btn-sm w-full justify-start"
                  onClick={close}
                >
                  <SettingsIcon className="mr-2 size-4" />
                  Settings
                </Link>

                <div
                  className="relative rounded-xl"
                  onMouseEnter={openThemeMenu}
                  onMouseLeave={scheduleThemeMenuClose}
                >
                  <button
                    ref={themeRefs.setReference}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-base-content/5"
                    onClick={() => {
                      clearThemeCloseTimeout();
                      setIsThemeMenuPinned((currentValue) => {
                        const nextValue = !currentValue;
                        setIsThemeMenuOpen(nextValue || !isThemeMenuOpen);
                        return nextValue;
                      });
                    }}
                  >
                    <span className="flex min-w-0 shrink-0 items-center gap-2">
                      <PaletteIcon className="size-4 shrink-0" />
                      <span className="truncate">Theme</span>
                    </span>
                    <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-xs font-normal opacity-70">
                      <span className="truncate">{activeTheme.label}</span>
                      <ChevronRightIcon
                        className={`size-4 shrink-0 transition-transform ${isThemeMenuOpen ? "rotate-90 sm:rotate-0" : ""}`}
                      />
                    </span>
                  </button>

                </div>

                {isThemeMenuOpen ? (
                  <div
                    ref={themeRefs.setFloating}
                    style={themeStyles}
                    className="z-50 w-52 rounded-xl border border-base-content/10 bg-base-100 p-2 shadow-2xl backdrop-blur"
                    onMouseEnter={openThemeMenu}
                    onMouseLeave={scheduleThemeMenuClose}
                  >
                    <div className="space-y-1">
                      {THEMES.map((themeOption) => (
                        <button
                          key={themeOption.name}
                          type="button"
                          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                            theme === themeOption.name
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-base-content/5"
                          }`}
                          onClick={() => {
                            setTheme(themeOption.name);
                            setIsThemeMenuOpen(false);
                            setIsThemeMenuPinned(false);
                          }}
                        >
                          <span className="truncate font-medium">{themeOption.label}</span>
                          <span className="flex shrink-0 gap-1">
                            {themeOption.colors.slice(0, 4).map((color) => (
                              <span
                                key={`${themeOption.name}-${color}`}
                                className="size-2 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="btn btn-ghost btn-sm w-full justify-start text-error"
                  onClick={() => {
                    close();
                    logoutMutation();
                  }}
                >
                  <LogOutIcon className="mr-2 size-4" />
                  Log out
                </button>
              </div>
            )}
          </ToggleDropdown>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
