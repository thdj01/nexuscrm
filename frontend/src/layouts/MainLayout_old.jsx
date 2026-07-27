// import React, { useState } from 'react';
// import { Outlet } from 'react-router-dom';
// import Sidebar from '../components/common/Sidebar';
// import Topbar from '../components/common/Topbar';

// const MainLayout = () => {
//   const [mobileOpen, setMobileOpen] = useState(false);

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar
//         mobileOpen={mobileOpen}
//         onMobileClose={() => setMobileOpen(false)}
//       />

//       {/* Main content — on desktop offset by sidebar, on mobile full-width */}
//       <div className="flex-1 flex flex-col min-h-screen md:ml-60 transition-all duration-300">
//         <Topbar onMenuClick={() => setMobileOpen(true)} />
//         <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
//           <Outlet />
//         </main>
//       </div>
//     </div>
//   );
// };

// export default MainLayout;

import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Topbar from '../components/common/Topbar';

const MainLayout = () => {
  // mobileOpen → off-canvas drawer visibility (below lg)
  // collapsed  → desktop icon-rail toggle (lg and up only)
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const isProjectDetailPage = location.pathname.startsWith('/projects/') && location.pathname !== '/projects';

  // Keep the two modes mutually consistent across breakpoint changes:
  //  - entering desktop (≥1024px): always close the mobile drawer
  //  - entering mobile  (<1024px): never stay collapsed (drawer shows full labels)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');

    const sync = (e) => {
      if (e.matches) {
        setMobileOpen(false);
      } else {
        setCollapsed(false);
      }
    };

    sync(mq);

    // addEventListener is the modern API; fall back for older Safari.
    if (mq.addEventListener) {
      mq.addEventListener('change', sync);
      return () => mq.removeEventListener('change', sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />

      {/* Mobile backdrop — sits below the drawer (z-50) but above content */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/*
        Main content.
        Sidebar is fixed, so desktop content must be offset AND reduced by the
        same sidebar width. Using only margin-left keeps the content at full
        viewport width and clips the right side on pages with grids/tables.
      */}
      <div
        className={`flex h-screen w-full min-w-0 flex-col transition-all duration-300 lg:flex-none ${
          collapsed
            ? 'lg:ml-16 lg:w-[calc(100%_-_4rem)]'
            : 'lg:ml-60 lg:w-[calc(100%_-_15rem)]'
        }`}
      >
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className={`min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-5 xl:px-6 ${isProjectDetailPage ? 'pb-0 pt-0 sm:pb-0 sm:pt-0 xl:pb-0 xl:pt-0' : 'pb-3 pt-3 sm:pb-5 sm:pt-5 xl:pb-6 xl:pt-6'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;