import { Link, useLocation } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import {
    BellIcon,
    CompassIcon,
    HomeIcon,
    MenuIcon,
    SettingsIcon,
    ShipWheelIcon,
    UsersIcon,
} from "lucide-react";
import AvatarImage from "./AvatarImage";
import { useEffect, useState } from "react";
import useUnreadNotificationCount from "../hooks/useUnreadNotificationCount";

const sidebarItems = [
    { to: "/", label: "Home", icon: HomeIcon },
    { to: "/friends", label: "Friends", icon: UsersIcon },
    { to: "/discover", label: "Discover", icon: CompassIcon },
    { to: "/notifications", label: "Notifications", icon: BellIcon },
    { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const Sidebar = () => {
    const { authUser } = useAuthUser();
    const unreadNotificationCount = useUnreadNotificationCount();
    const location = useLocation();
    const currentPath = location.pathname;
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem("securechat-sidebar-collapsed") === "true";
    });

    useEffect(() => {
        localStorage.setItem("securechat-sidebar-collapsed", String(isCollapsed));
    }, [isCollapsed]);

    return (
        <aside
            className={`hidden h-screen shrink-0 flex-col border-r border-base-300 bg-base-200 transition-[width] duration-200 lg:sticky lg:top-0 lg:flex ${
                isCollapsed ? "w-20" : "w-64"
            }`}
        >
            <div className="border-b border-base-300 p-4">
                <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2"}`}>
                    <button
                        type="button"
                        className="btn btn-ghost btn-circle btn-sm shrink-0"
                        onClick={() => setIsCollapsed((currentValue) => !currentValue)}
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <MenuIcon className="size-5" />
                    </button>
                    {!isCollapsed ? (
                        <Link
                            to="/"
                            className="flex min-w-0 flex-1 items-center gap-2"
                            title="SecureChat"
                        >
                            <ShipWheelIcon className="size-8 shrink-0 text-primary" />
                            <span className="whitespace-nowrap bg-gradient-to-r from-primary to-secondary bg-clip-text font-mono text-2xl font-bold tracking-wide text-transparent">
                                SecureChat
                            </span>
                        </Link>
                    ) : null}
                </div>
            </div>

            <nav className={`flex-1 space-y-1 p-3 ${isCollapsed ? "px-3" : "px-4"}`}>
                {sidebarItems.map(({ to, label, icon: Icon }) => {
                    const showUnreadBadge = to === "/notifications" && unreadNotificationCount > 0;

                    return (
                    <Link
                        key={to}
                        to={to}
                        title={isCollapsed ? label : undefined}
                        aria-label={label}
                        className={`btn btn-ghost relative w-full gap-3 normal-case ${
                            isCollapsed ? "btn-circle justify-center px-0" : "justify-start px-3"
                        } ${currentPath === to ? "btn-active" : ""}`}
                    >
                        <Icon className="size-5 shrink-0 text-base-content opacity-70" />
                        {!isCollapsed ? <span className="truncate">{label}</span> : null}
                        {showUnreadBadge ? (
                            <span
                                className={`badge badge-error badge-sm ${
                                    isCollapsed ? "absolute -right-0.5 -top-0.5 px-1" : "ml-auto"
                                }`}
                            >
                                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                            </span>
                        ) : null}
                    </Link>
                    );
                })}
            </nav>

            <div className="mt-auto border-t border-base-300 p-4">
                <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
                    <div className="avatar">
                        <div className="w-10 rounded-full">
                            <AvatarImage
                                src={authUser?.profilePic}
                                name={authUser?.fullName}
                                alt="User Avatar"
                            />
                        </div>
                    </div>
                    {!isCollapsed ? (
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">{authUser?.fullName}</p>
                        <p className="text-xs text-success flex items-center gap-1">
                            <span className="size-2 rounded-full bg-success inline-block" />
                            Online
                        </p>
                    </div>
                    ) : null}
                </div>
            </div>
        </aside>
    );
};
export default Sidebar;
