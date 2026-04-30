// import { Link, useLocation } from "react-router";
// import useAuthUser from "../hooks/useAuthUser";
// import { BellIcon, LogOutIcon, SettingsIcon, ShipWheelIcon } from "lucide-react";
// import ThemeSelector from "./ThemeSelector";
// import useLogout from "../hooks/useLogout";
// import AvatarImage from "./AvatarImage";

// const Navbar = () => {
//   const { authUser } = useAuthUser();
//   const location = useLocation();
//   const isChatPage = location.pathname?.startsWith("/chat");

//   // const queryClient = useQueryClient();
//   // const { mutate: logoutMutation } = useMutation({
//   //   mutationFn: logout,
//   //   onSuccess: () => queryClient.invalidateQueries({ queryKey: ["authUser"] }),
//   // });

//   const { logoutMutation } = useLogout();

//   return (
//     <nav className="bg-base-200 border-b border-base-300 sticky top-0 z-30 h-16 flex items-center">
//       <div className="container mx-auto px-4 sm:px-6 lg:px-8">
//         <div className="flex items-center justify-end w-full">
//           {/* LOGO - ONLY IN THE CHAT PAGE */}
//           {isChatPage && (
//             <div className="pl-5">
//               <Link to="/" className="flex items-center gap-2.5">
//                 <ShipWheelIcon className="size-9 text-primary" />
//                 <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary  tracking-wider">
//                   SecureChat
//                 </span>
//               </Link>
//             </div>
//           )}

//           <div className="flex items-center gap-3 sm:gap-4 ml-auto">
//             <Link to={"/notifications"}>
//               <button className="btn btn-ghost btn-circle">
//                 <BellIcon className="h-6 w-6 text-base-content opacity-70" />
//               </button>
//             </Link>
//             <Link to="/settings">
//               <button className="btn btn-ghost btn-circle">
//                 <SettingsIcon className="h-6 w-6 text-base-content opacity-70" />
//               </button>
//             </Link>
//           </div>

//           {/* TODO */}
//           <ThemeSelector />

//           <div className="avatar">
//             <div className="w-9 rounded-full">
//               <AvatarImage src={authUser?.profilePic} name={authUser?.fullName} alt="User Avatar" />
//             </div>
//           </div>

//           {/* Logout button */}
//           <button className="btn btn-ghost btn-circle" onClick={logoutMutation}>
//             <LogOutIcon className="h-6 w-6 text-base-content opacity-70" />
//           </button>
//         </div>
//       </div>
//     </nav>
//   );
// };
// export default Navbar;


import { Link, useLocation } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import useLogout from "../hooks/useLogout";

import {
  BellIcon,
  LogOutIcon,
  SettingsIcon,
  ShipWheelIcon,
} from "lucide-react";

import ThemeSelector from "./ThemeSelector";
import AvatarImage from "./AvatarImage";

const Navbar = () => {
  const { authUser } = useAuthUser();
  const { logoutMutation } = useLogout();
  const location = useLocation();

  const isChatPage = location.pathname?.startsWith("/chat");

  return (
    <nav className="bg-base-200 border-b border-base-300 sticky top-0 z-30 h-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        
        {/* LEFT SECTION (LOGO) */}
        {isChatPage ? (
          <Link to="/" className="flex items-center gap-2.5">
            <ShipWheelIcon className="size-8 text-primary" />
            <span className="text-2xl font-bold font-mono bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent tracking-wide">
              SecureChat
            </span>
          </Link>
        ) : (
          <div /> // Keeps spacing consistent
        )}

        {/* RIGHT SECTION */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Notifications */}
          <Link to="/notifications">
            <button className="btn btn-ghost btn-circle">
              <BellIcon className="h-5 w-5 opacity-70" />
            </button>
          </Link>

          {/* Settings */}
          <Link to="/settings">
            <button className="btn btn-ghost btn-circle">
              <SettingsIcon className="h-5 w-5 opacity-70" />
            </button>
          </Link>

          {/* Theme */}
          <ThemeSelector />

          {/* Avatar */}
          <div className="avatar">
            <div className="w-9 rounded-full">
              <AvatarImage
                src={authUser?.profilePic}
                name={authUser?.fullName}
                alt="User Avatar"
              />
            </div>
          </div>

          {/* Logout */}
          <button
            className="btn btn-ghost btn-circle"
            onClick={logoutMutation}
          >
            <LogOutIcon className="h-5 w-5 opacity-70" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;