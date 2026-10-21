import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import CreatePostModal from '../posts/CreatePostModal';

export default function Layout() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="min-h-screen text-white relative">
      <div className="relative z-10 flex min-h-screen">
        <Sidebar onCreatePost={() => setCreateOpen(true)} />

        {/* Page content */}
        <main className="flex-1 md:pl-[72px] xl:pl-56 pb-16 md:pb-0 min-h-screen">
          <Outlet />
        </main>
      </div>

      <CreatePostModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

