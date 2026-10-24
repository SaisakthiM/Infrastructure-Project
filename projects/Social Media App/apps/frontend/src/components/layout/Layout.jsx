import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import CreatePostModal from '../posts/CreatePostModal';

export default function Layout() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    /* the city HUD is a fixed 56px band (city.css --hud-h) mounted outside #root, so nothing here
       may sit under it: the padding reserves the band for every page in this layout. */
    <div className="min-h-screen text-zinc-950 relative pt-[var(--hud-h)]">
      <div className="relative z-10 flex min-h-full">
        <Sidebar onCreatePost={() => setCreateOpen(true)} />

        {/* Page content */}
        <main className="flex-1 md:pl-[72px] xl:pl-56 pb-16 md:pb-0 min-h-[calc(100vh_-_var(--hud-h))]">
          <Outlet />
        </main>
      </div>

      <CreatePostModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

