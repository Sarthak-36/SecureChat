import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import MobileBottomNav from "./MobileBottomNav";

const Layout = ({ children, showSidebar = false }) => {
  return (
    <div className="h-screen overflow-hidden">
      <div className="flex h-full min-h-0">
        {showSidebar && <Sidebar />}

        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar />

          <main
            className={`min-h-0 flex-1 ${
              showSidebar ? "overflow-y-auto pb-20 lg:pb-0" : "overflow-hidden"
            }`}
          >
            {children}
          </main>
          {showSidebar ? <MobileBottomNav /> : null}
        </div>
      </div>
    </div>
  );
};
export default Layout;
