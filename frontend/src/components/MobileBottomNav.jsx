import { createElement } from "react";
import { Link, useLocation } from "react-router";
import {
  BellIcon,
  CompassIcon,
  HomeIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import useUnreadNotificationCount from "../hooks/useUnreadNotificationCount";

const mobileNavItems = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/friends", label: "Friends", icon: UsersIcon },
  { to: "/discover", label: "Discover", icon: CompassIcon },
  { to: "/notifications", label: "Alerts", icon: BellIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const unreadNotificationCount = useUnreadNotificationCount();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-base-content/10 bg-base-100/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {mobileNavItems.map(({ to, label, icon }) => {
          const isActive = pathname === to;
          const showUnreadBadge = to === "/notifications" && unreadNotificationCount > 0;

          return (
            <Link
              key={to}
              to={to}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors ${
                isActive ? "bg-primary/10 text-primary" : "text-base-content/65"
              }`}
              aria-label={label}
            >
              <span className="relative">
                {createElement(icon, { className: "size-5 shrink-0" })}
                {showUnreadBadge ? (
                  <span className="absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-error px-1 text-[10px] font-bold leading-4 text-error-content">
                    {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
