import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import CreatePostModal from '../posts/CreatePostModal';

export default function Layout() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <Sidebar onCreatePost={() => setCreateOpen(true)} />

      {/* Page content */}
      <main className="md:pl-[72px] xl:pl-56 pb-16 md:pb-0 min-h-screen">
        <Outlet />
      </main>

      <CreatePostModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

